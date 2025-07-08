precision mediump float;

varying vec3 vPosition;
varying vec3 vNormal;

uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform float uLightIntensity;

uniform vec3 uBaseColor;
uniform float uShininess;
uniform float uSpecularStrength;
uniform vec3 uViewPos;

uniform int uIsShadow;  
uniform int uIsFlower;
uniform float uTime;

uniform bool uIsParticle;

vec3 calculatePointLight(vec3 lightPos, vec3 lightColor, float intensity, vec3 normal, vec3 fragPos, vec3 viewDir) {
    vec3 lightDir = normalize(lightPos - fragPos);
    
    float diff = max(dot(normal, lightDir), 0.0);
    
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0), uShininess);
    
    float distance = length(lightPos - fragPos);
    float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * (distance * distance));
    
    vec3 diffuse = diff * lightColor * intensity;
    vec3 specular = spec * lightColor * intensity * 0.5;
    
    return (diffuse + specular) * attenuation;
}

vec3 createGradientColor(vec3 baseColor, vec3 position) {
    float gradientFactor = smoothstep(-0.2, 0.3, position.y);
    
    vec3 bottomColor = vec3(0.0, 0.3, 0.1);  
    vec3 topColor = vec3(1.0, 0.2, 0.9);    

    vec3 gradientColor = mix(bottomColor, topColor, gradientFactor);
    
    float hue = uTime * 0.1;
    vec3 colorVariation = vec3(
        0.1 * sin(hue),
        0.1 * sin(hue + 1.57),
        0.1 * sin(hue + 3.14)
    );
    
    return gradientColor + colorVariation;
}

void main() {
    if (uIsParticle) {
        gl_FragColor = vec4(uBaseColor, 0.6);
        return;
    }

    if (uIsShadow == 1) {
        vec3 shadowColor = vec3(0.05, 0.1, 0.05);
        gl_FragColor = vec4(shadowColor, 0.8);
        return;
    }

    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(uViewPos - vPosition);
    
    vec3 baseColor = (uIsFlower == 1) ? createGradientColor(uBaseColor, vPosition) : uBaseColor;
    
    vec3 ambient = 0.1 * baseColor;
    
    vec3 lighting = ambient;    
    
    lighting += calculatePointLight(
        uLightPosition, 
        uLightColor, 
        uLightIntensity, 
        normal, 
        vPosition, 
        viewDir
    ) * baseColor;
    
    
    gl_FragColor = vec4(lighting, 1.0);
}
