attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uNormalMatrix;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(mat3(uNormalMatrix) * aNormal);
  vec4 pos = uModelViewMatrix * vec4(aPosition, 1.0);
  vPosition = pos.xyz;
  gl_Position = uProjectionMatrix * pos;
}
