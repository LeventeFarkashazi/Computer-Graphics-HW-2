#version 330

in vec4 vertexPos;

out vec2 texCoord;

void main() {
    gl_Position = vertexPos;
    texCoord = vertexPos.xy * 0.5 + 0.5;
}