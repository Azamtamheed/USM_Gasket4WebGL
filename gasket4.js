/*-----------------------------------------------------------------------------------*/
// Variable Declaration
/*-----------------------------------------------------------------------------------*/

// Common variables
var canvas, gl, program;

let positionBuffer, colorBuffer, textureBuffer;
let vertexPosition, vertexColor, vertexTexCoord;
let modelViewMatrixLocation, projectionMatrixLocation, texCoordLocation;
var modelViewMatrix, projectionMatrix, texture;

// Variables referencing HTML elements
var subdivSlider, subdivText, iterSlider, iterText, startBtn;
var checkTex1, checkTex2, checkTex3, tex1, tex2, tex3;

var theta = [0, 0, 0], move = [0, 0, 0];
var subdivisions = 3, iterations = 1, scaling = 1;
var iterTemp = 0, animSeq = 0, animFrame = 0, animFlag = false;

// Variables for the 3D Sierpinski gasket
var points = [], colors = [], textures = [];

// Vertices for the 3D Sierpinski gasket (X-axis, Y-axis, Z-axis, W)
// For 3D, you need to set the z-axis to create the perception of depth
var vertices = [
    vec4( 0.0000,  0.0000, -1.0000, 1.0000),
    vec4( 0.0000,  0.9428,  0.3333, 1.0000),
    vec4(-0.8165, -0.4714,  0.3333, 1.0000),
    vec4( 0.8165, -0.4714,  0.3333, 1.0000)
];

// Different colors for a tetrahedron (RGBA)
var baseColors = [
    vec4(1.0, 0.2, 0.4, 1.0),
    vec4(0.0, 0.9, 1.0, 1.0),
    vec4(0.2, 0.2, 0.5, 1.0),
    vec4(0.0, 0.0, 0.0, 1.0)
];

// Define texture coordinates for texture mapping onto a shape or surface
var texCoord = 
[
    vec2(0, 0), // Bottom-left corner of the texture
    vec2(0, 1), // Top-left corner of the texture
    vec2(1, 1), // Top-right corner of the texture
    vec2(1, 0)  // Bottom-right corner of the texture
];

/*-----------------------------------------------------------------------------------*/
// WebGL Utilities
/*-----------------------------------------------------------------------------------*/

window.onload = function init()
{
    // Primitive (geometric shape) initialization
    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], subdivisions);

    // WebGL setups
    configUIElements();
    configWebGL();
    configureTexture(tex1);
    render();
}

// Retrieve all elements from HTML and store in the corresponding variables
function configUIElements()
{
    canvas = document.getElementById("gl-canvas");

    subdivSlider = document.getElementById("subdiv-slider");
    subdivText = document.getElementById("subdiv-text");
    
    iterSlider = document.getElementById("iter-slider");
    iterText = document.getElementById("iter-text");
    
    checkTex1 = document.getElementById("check-texture-1");
    checkTex2 = document.getElementById("check-texture-2");
    checkTex3 = document.getElementById("check-texture-3");
    
    tex1 = document.getElementById("texture-1");
	tex2 = document.getElementById("texture-2");
    tex3 = document.getElementById("texture-3");
    
    startBtn = document.getElementById("start-btn");

    subdivSlider.onchange = function(event) 
	{
		subdivisions = event.target.value;
		subdivText.innerHTML = subdivisions;
        recompute();
    };

    iterSlider.onchange = function(event) 
	{
		iterations = event.target.value;
		iterText.innerHTML = iterations;
        recompute();
    };

    checkTex1.onchange = function() 
	{
		if(checkTex1.checked)
        {
            configureTexture(tex1);
            recompute();
        }
    };

    checkTex2.onchange = function() 
	{
		if(checkTex2.checked)
        {
            configureTexture(tex2);
            recompute();
        }
    };

    checkTex3.onchange = function() 
	{
		if(checkTex3.checked)
        {
            configureTexture(tex3);
            recompute();
        }
    };

    startBtn.onclick = function()
	{
		animFlag = true;
        toggleUI();
        resetValue();
        animUpdate();
	};
}

// Configure WebGL Settings
function configWebGL()
{
    // Initialize the WebGL context
    gl = WebGLUtils.setupWebGL(canvas);
    
    if(!gl)
    {
        alert("WebGL isn't available");
        return;
    }

    // Set the viewport and clear the color
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Create buffers and link them to the corresponding attribute variables in vertex and fragment shaders

    // Set positions
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    vertexPosition = gl.getAttribLocation(program, "aVertexPosition");
    gl.vertexAttribPointer(vertexPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPosition);

    // Set colors
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    
    vertexColor = gl.getAttribLocation(program, "aVertexColor");
    gl.vertexAttribPointer(vertexColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexColor);

    // Set textures
    textureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(textures), gl.STATIC_DRAW);
    
    vertexTexCoord = gl.getAttribLocation(program, "aVertexTexCoord");
    gl.vertexAttribPointer(vertexTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexTexCoord);

    // Get the location of the uniform variables within a compiled shader program
    projectionMatrixLocation = gl.getUniformLocation(program, "uProjectionMatrix");
    modelViewMatrixLocation = gl.getUniformLocation(program, "uModelViewMatrix");
    texCoordLocation = gl.getUniformLocation(program, "uTexture");
}

// Render the graphics for viewing
function render()
{
    // Cancel the animation frame before performing any graphic rendering
    if(animFlag)
    {
        animFlag = false;
        window.cancelAnimationFrame(animFrame);
    }
    
    // Clear the color buffer and the depth buffer before rendering a new frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Pass a 4x4 projection matrix from JavaScript to the GPU for use in shader
    // ortho(left, right, bottom, top, near, far)
    projectionMatrix = ortho(-4, 4, -2.25, 2.25, 2, -2);
	gl.uniformMatrix4fv(projectionMatrixLocation, false, flatten(projectionMatrix));

    // Pass a 4x4 model view matrix from JavaScript to the GPU for use in shader
    // Use translation to readjust the position of the primitive (if needed)
    modelViewMatrix = mat4();
    modelViewMatrix = mult(modelViewMatrix, translate(0, -0.2357, 0));
    gl.uniformMatrix4fv(modelViewMatrixLocation, false, flatten(modelViewMatrix));

    gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.uniform1i(texCoordLocation, 0);

    // Draw the primitive / geometric shape
    gl.drawArrays(gl.TRIANGLES, 0, points.length);
}

// Recompute points and colors, followed by reconfiguring WebGL for rendering
function recompute()
{
    // Reset points and colors for render update
    points = [];
	colors = [];
    
    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], subdivisions);
    configWebGL();
    render();
}

// Update the animation frame
function animUpdate()
{
    // Stop the animation frame and return upon completing all sequences
    if(iterTemp == iterations)
    {
        window.cancelAnimationFrame(animFrame);
        toggleUI();
        animFlag = false;
        return; // break the self-repeating loop
    }

    // Clear the color buffer and the depth buffer before rendering a new frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set the model view matrix for vertex transformation
    // Use translation to readjust the position of the primitive (if needed)
    modelViewMatrix = mat4();
    modelViewMatrix = mult(modelViewMatrix, translate(0, -0.2357, 0));

    // Switch case to handle the ongoing animation sequence
    // The animation is executed sequentially from case 0 to case n
    switch(animSeq)
    {
        case 0: // Animation 1: Rotate Right 180°
            theta[2] -= 1;

            if(theta[2] <= -180)
            {
                theta[2] = -180;
                animSeq++;
            }

            break;

        case 1: // Animation 2
            theta[2] += 1;

            if(theta[2] >= 0)
            {
                theta[2] = 0;
                animSeq++;
            }

            break;

        case 2: // Animation 3
            scaling += 0.02;
            
            if(scaling >= 4)
            {
                scaling = 4;
                animSeq++;
            }

            break;

        case 3: // Animation 4
            scaling -= 0.02;

            if(scaling <= 1)
            {
                scaling = 1;
                animSeq++;
            }

            break;

        case 4: // Animation 5
            move[0] += 0.0125;
            move[1] += 0.005;

            if(move[0] >= 3.0 && move[1] >= 1.2)
            {
                move[0] = 3.0;
                move[1] = 1.2;
                animSeq++;
            }
            break;

        case 5: // Animation 6
            move[0] -= 0.0125;
            move[1] -= 0.005;

            if(move[0] <= -3.0 && move[1] <= -1.2)
            {
                move[0] = -3.0;
                move[1] = -1.2;
                animSeq++;
            }
            break;

        case 6: // Animation 7
            move[0] += 0.0125;
            move[1] += 0.005;

            if(move[0] >= 0 && move[1] >= 0)
            {
                move[0] = 0;
                move[1] = 0;
                animSeq++;
            }
            break;

        default: // Reset animation sequence
            animSeq = 0;
            iterTemp++;
            break;
    }

    // Perform vertex transformation
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta[2]));
    modelViewMatrix = mult(modelViewMatrix, scale(scaling, scaling, 1));
    modelViewMatrix = mult(modelViewMatrix, translate(move[0], move[1], move[2]));

    // Pass the matrix to the GPU for use in shader
    gl.uniformMatrix4fv(modelViewMatrixLocation, false, flatten(modelViewMatrix));

    // Draw the primitive / geometric shape
    gl.drawArrays(gl.TRIANGLES, 0, points.length);

    // Schedule the next frame for a looped animation (60fps)
    animFrame = window.requestAnimationFrame(animUpdate);
}

// Toggle the UI elements to disabled/enabled
function toggleUI()
{
    subdivSlider.disabled = !subdivSlider.disabled;
    iterSlider.disabled = !iterSlider.disabled;
    checkTex1.disabled = !checkTex1.disabled;
    checkTex2.disabled = !checkTex2.disabled;
    checkTex3.disabled = !checkTex3.disabled;
    startBtn.disabled = !startBtn.disabled;
}

// Reset all necessary variables to their default values
function resetValue()
{
    theta = [0, 0, 0];
    move = [0, 0, 0];
    scaling = 1;
    animSeq = 0;
    iterTemp = 0;
}

// Check whether whether a given number value is a power of 2
function isPowerOf2(value)
{
  return (value & (value - 1)) == 0;
}

// Configure the texture
function configureTexture(tex)
{
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, tex);

	if (isPowerOf2(tex.width) && isPowerOf2(tex.height))
	{
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
	else
	{
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
}

/*-----------------------------------------------------------------------------------*/
// 3D Sierpinski Gasket
/*-----------------------------------------------------------------------------------*/

// Form a triangle
function triangle(a, b, c, color)
{
    colors.push(baseColors[color]);
    points.push(a);
    textures.push(texCoord[0]);
    colors.push(baseColors[color]);
    points.push(b);
    textures.push(texCoord[1]);
    colors.push(baseColors[color]);
    points.push(c);
    textures.push(texCoord[2]);
    console.log(points);
}

// Form a tetrahedron with different color for each side
function tetra(a, b, c, d)
{
    triangle(a, c, b, 0);
    triangle(a, c, d, 1);
    triangle(a, b, d, 2);
    triangle(b, c, d, 3);
}

// subdivisions a tetrahedron
function divideTetra(a, b, c, d, count)
{
    // Check for end of recursion
    if(count === 0)
    {
        tetra(a, b, c, d);
    }

    // Find midpoints of sides and divide into four smaller tetrahedra
    else
    {
        var ab = mix(a, b, 0.5);
        var ac = mix(a, c, 0.5);
        var ad = mix(a, d, 0.5);
        var bc = mix(b, c, 0.5);
        var bd = mix(b, d, 0.5);
        var cd = mix(c, d, 0.5);
        --count;

        divideTetra(a, ab, ac, ad, count);
        divideTetra(ab, b, bc, bd, count);
        divideTetra(ac, bc, c, cd, count);
        divideTetra(ad, bd, cd, d, count);
    }
}

/*-----------------------------------------------------------------------------------*/