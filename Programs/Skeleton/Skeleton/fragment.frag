#version 330 core

const float PI = 3.141592654;

in vec2 texCoord;
uniform float frame;
uniform mat4 camDirMat;

out vec4 fragColor;

vec3 movingLightPos;

struct Material {
		vec3 ka, kd, ks;
		float  shininess;
		vec3 F0;
		int rough, reflective;
	};

struct Light {
	vec3 direction;
	vec3 Le, La;
};

struct Hit {
	float t;
	vec3 position, normal;
	int mat;	// material index
};

struct Ray {
	vec3 start, dir;
};

vec4 quat(vec3 rotAxis, float rotAangle) {
    vec4 q;
    float halfAngle = (rotAangle * 0.5);
    q.x = rotAxis.x * sin(halfAngle);
    q.y = rotAxis.y * sin(halfAngle);
    q.z = rotAxis.z * sin(halfAngle);
    q.w = cos(halfAngle);
    return q;
}

vec4 quatInv(vec4 q) {
    return vec4(-q.x, -q.y, -q.z, q.w);
}

vec4 quatMul(vec4 q1, vec4 q2) {	// quaternion multiplication
	vec3 d1 = vec3(q1.x, q1.y, q1.z);
    vec3 d2 = vec3(q2.x, q2.y, q2.z);
	vec3 imag = d2 * q1.w + d1 * q2.w + cross(d1, d2);
	return vec4(imag.x, imag.y, imag.z, q1.w * q2.w - dot(d1, d2));
}

vec3 quatRot(vec4 q, vec3 position) {
  vec4 qInv = quatInv(q);
  vec4 qPos = vec4(position.x, position.y, position.z, 0);
  
  vec4 tmp = quatMul(q, qPos);
  q = quatMul(tmp, qInv);
  return vec3(q.x, q.y, q.z);
}


float intersectSphere(vec3 rayOrigin, vec3 rayDir, vec3 center, float radius, out vec3 normal) {
    vec3 dist = rayOrigin - center;
    float a = dot(rayDir, rayDir);
    float b = dot(dist, rayDir) * 2.0;
    float c = dot(dist, dist) - radius * radius;
    float disc = b * b - 4 * a * c;
    if (disc < 0.0) {
        return -1.0;
    }
    float t = (-b - sqrt(disc)) / 2.0 / a;
    vec3 hitPos = rayOrigin + rayDir * t;
    
    normal = (hitPos - center) * (1.0 / radius);
    return t;
}

vec4 calcHitposAndT(float t1, float t2, vec3 hitPos1, vec3 hitPos2){
    vec3 hitPos;
    float t;

    if (t1 < 0.0 && t2 < 0.0) {
        t = -1.0;
    } else if (t2 < 0.0) {
        hitPos = hitPos1;
        t = t1;
    } else if (t1 < 0.0) {
        hitPos = hitPos2;
        t = t2;
    } else {
        if (t1 < t2) {
            hitPos = hitPos1;
            t = t1;
        } else {
            hitPos.xyz = hitPos2;
            t = t2;
        }
    }
    return vec4(hitPos,t);
}

// formula:https://nmd.pages.math.illinois.edu/quadrics/ellparab.html (switched y and z axis +  quadratic equation)
float intersectParaboloid(vec3 rayOrigin, vec3 rayDir, vec3 focus, float size, float height, out vec3 normal) {
    rayOrigin.x /= size;
    rayOrigin.z /= size;
    rayDir.x /= size;
    rayDir.z /= size;
    float a = dot(vec2(rayDir.x, rayDir.z), vec2(rayDir.x, rayDir.z));
    float b = dot(2.0 * vec2(rayOrigin.x, rayOrigin.z), vec2(rayDir.x, rayDir.z)) - rayDir.y;
    float c = dot(vec2(rayOrigin.x, rayOrigin.z), vec2(rayOrigin.x, rayOrigin.z)) - rayOrigin.y;
    float disc = b * b - 4 * a * c;
    if (disc < 0.0) {
        return -1.0;
    }
    float t1 = (-b - sqrt(disc)) / (2 * a);
    float t2 = (-b + sqrt(disc)) / (2 * a);
    vec3 hitPos1 = rayOrigin + rayDir * t1;
    vec3 hitPos2 = rayOrigin + rayDir * t2;
    if (hitPos1.y > height + focus.y){
        t1 = -1.0;
    }
    if (hitPos2.y > height + focus.y){
        t2 = -1.0;
    }
    vec4 hitposAndT = calcHitposAndT(t1, t2, hitPos1, hitPos2);

    normal = cross(vec3(1, 2 * hitposAndT.x, 0),vec3(0, 2 * hitposAndT.z ,1));
    normal = normalize(normal);

    return hitposAndT.w;
}

float intersectCylinder(vec3 rayOrigin, vec3 rayDir, vec3 center, float radius, float height, out vec3 normal) {
    vec2 dist = vec2(rayOrigin.x, rayOrigin.z) - vec2(center.x, center.z);
    float a = dot(vec2(rayDir.x, rayDir.z), vec2(rayDir.x, rayDir.z));
    float b = 2.0 * dot(dist, vec2(rayDir.x, rayDir.z));
    float c = dot(dist, dist) - radius * radius;
    float disc = b * b - 4 * a * c;
    if (disc < 0.0) {
        return -1.0;
    }
    float t1 = (-b - sqrt(disc)) / 2.0 / a;
    float t2 = (-b + sqrt(disc)) / 2.0 / a;
    vec3 hitPos1 = rayOrigin + rayDir * t1;
    vec3 hitPos2 = rayOrigin + rayDir * t2;
    if (hitPos1.y < center.y || hitPos1.y > height + center.y){
        t1 = -1.0;
    }
    if (hitPos2.y < center.y || hitPos2.y > height + center.y){
        t2 = -1.0;
    }
    
    vec4 hitposAndT = calcHitposAndT(t1, t2, hitPos1, hitPos2);
    
    normal = vec3(hitposAndT.x, hitposAndT.y, hitposAndT.z) - center;
    normal.y = 0.0;
    normal = normalize(normal);

    return hitposAndT.w;
}

float intersectPlane(vec3 rayOrigin, vec3 rayDir, vec3 point, vec3 normal) {
    return dot(point - rayOrigin, normal) / dot(rayDir, normal);
}

float intersectCircle(vec3 rayOrigin, vec3 rayDir, vec3 center, float radius, vec3 normal) {
    float t = intersectPlane(rayOrigin, rayDir, center, normal);
    vec3 hitPos = rayOrigin + rayDir * t;
    //formula: https://www.mathcentre.ac.uk/resources/uploaded/mc-ty-circles-2009-1.pdf
    if (hitPos.x * hitPos.x + hitPos.z * hitPos.z > radius * radius) {
        return -1.0;
    }
    return t;
}

float merge(float t1, float t2, vec3 normal1, vec3 normal2, out vec3 normal) {
    float t;
    if (t1 < 0.0 && t2 < 0.0){ 
        return -1.0;
    }
    if (t2 < 0.0) {
        normal = normal1;
        return t1;
    } 
    if (t1 < 0.0) {
        normal = normal2;
        return t2;
    } 
    if (t1 < t2) {
        normal = normal1;
        return t1;
    } 
    normal = normal2;
    return t2;
} 

float intersectAll(vec3 rayOrigin, vec3 rayDir, out vec3 normal) {
    float time = frame / 100.0;
    vec3 baseNormal;
    vec3 baseTopNormal = vec3(0, 1, 0);
    vec3 rod1Normal;
    vec3 sphereJoint1Normal;
    vec3 groundNormal = vec3(0, 1, 0);

    float tGround = intersectPlane(rayOrigin, rayDir, vec3(0, 0, 0), groundNormal);

    float tBase = intersectCylinder(rayOrigin, rayDir, vec3(0, 0, 0), 1.0, 0.2, baseNormal);

    float tBaseTop = intersectCircle(rayOrigin, rayDir, vec3(0, 0.2, 0), 1, baseTopNormal);

    float tSphereJoint1 = intersectSphere(rayOrigin, rayDir, vec3(0, 0.2, 0), 0.2, sphereJoint1Normal);
    
    //rotate the first rod 
    vec4 q = quat(normalize(vec3(1, 6, 3)), time);
    vec3 rotOrigin1 = quatRot(q, rayOrigin + vec3(0,-0.2,0));
    vec3 rotRayDir1 = quatRot(q, rayDir);
    
    float rod1 = intersectCylinder(rotOrigin1, rotRayDir1, vec3(0, 0, 0), 0.11, 3.0, rod1Normal);
    rod1Normal = quatRot(quatInv(q), rod1Normal);
    
    vec3 sphereJoint2Normal;
    float tSphereJoint2 = intersectSphere(rotOrigin1, rotRayDir1, vec3(0, 3, 0), 0.2, sphereJoint2Normal);
    sphereJoint2Normal = quatRot(quatInv(q), sphereJoint2Normal);

    //rotate the second rod 
    vec4 q2 = quat(normalize(vec3(2, 3, 4)), time + 1.5);
    vec3 rotOrigin2 = quatRot(q2, rotOrigin1 + vec3(0,-3.0,0));
    vec3 rotRayDir2 = quatRot(q2, rotRayDir1);

    vec3 rod2Normal;
    float rod2 = intersectCylinder(rotOrigin2, rotRayDir2, vec3(0, 0, 0), 0.11, 2.0, rod2Normal);
    rod2Normal = quatRot(quatInv(q2), rod2Normal);
    rod2Normal = quatRot(quatInv(q), rod2Normal);

    vec3 sphereJoint3Normal;
    float tSphereJoint3 = intersectSphere(rotOrigin2, rotRayDir2, vec3(0, 2, 0), 0.2, sphereJoint3Normal);
    sphereJoint3Normal = quatRot(quatInv(q2), sphereJoint3Normal);
    sphereJoint3Normal = quatRot(quatInv(q), sphereJoint3Normal);

    //rotate the lamp shade 
    vec4 q3 = quat(normalize(vec3(4, 1, 1)), 7.5);
    vec3 rotOrigin3 = quatRot(q3, rotOrigin2 + vec3(0,-2.0,0));
    vec3 rotRayDir3 = quatRot(q3, rotRayDir2);

    vec4 q4 = quat(normalize(vec3(1, 4, 1)), time);
    vec3 rotOrigin4 = quatRot(q4, rotOrigin3);
    vec3 rotRayDir4 = quatRot(q4, rotRayDir3);

    vec3 lampShadeNormal;
    float tLampShade = intersectParaboloid(rotOrigin4, rotRayDir4, vec3(0, 0, 0), 0.8, 1.0, lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q4), lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q3), lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q2), lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q), lampShadeNormal);

    
    float t;
    t = merge(tGround, tBase, groundNormal, baseNormal, normal);
    t = merge(t, tBaseTop, normal, baseTopNormal, normal);
    t = merge(t, tSphereJoint1, normal, sphereJoint1Normal, normal);
    t = merge(t, rod1, normal, rod1Normal, normal);
    t = merge(t, tSphereJoint2, normal, sphereJoint2Normal, normal);
    t = merge(t, rod2, normal, rod2Normal, normal);
    t = merge(t, tSphereJoint3, normal, sphereJoint3Normal, normal);
    t = merge(t, tLampShade, normal, lampShadeNormal, normal);

    movingLightPos = vec3(0, 0.2, 0);
    movingLightPos += quatRot(quatInv(q), vec3(0,3,0));

    movingLightPos += vec3(0, 0.3, 0);
    return t;
}

void main() {
    float time = frame / 100.0;
    vec3 lightPos = vec3(10,15,10);
    //vec3 lightPos = vec3(0,0,0);

    //vec3 lightPos2 = vec3(-10,15,-10);
    

    float fov = PI / 2;
    
    vec3 rayOrigin = vec3(0, 6, 5); //~ cam pos
    vec3 rayDir = normalize(vec3(texCoord * 2 - 1, -tan(fov / 2.0)));
    rayDir = (vec4(rayDir, 0) * camDirMat).xyz;

    vec3 normal;
    float t = intersectAll(rayOrigin, rayDir, normal);
    
    vec3 lightPos2 = movingLightPos;

    if (dot(normal, rayDir) > 0.0) {
        normal *= -1;
    }
    
    vec3 hitPos = rayOrigin + rayDir * t;
    
    vec3 toLight = lightPos - hitPos;
    vec3 toLight2 = lightPos2 - hitPos;

    float distToLight = length(toLight);
    float distToLight2 = length(toLight2);
    
    toLight /= distToLight;
    toLight2 /= distToLight2;
    
    if (t > 0.0) {
        float cosTheta = max(dot(toLight, normal), 0.0);
        float cosTheta2 = max(dot(toLight2, normal), 0.0);
        
        vec3 _;
        vec3 _2;

        const float epsilon = 0.0001;
        
        float lightT = intersectAll(hitPos + normal * epsilon, toLight, _);
        float lightT2 = intersectAll(hitPos + normal * epsilon, toLight2, _2);

        float lightIntensity = 100.0;
        float lightIntensity2 = 50.0;

        if (lightT > 0.0) {
            lightIntensity = 0.0;
        }
        
        if (lightT2 > 0.0) {
            lightIntensity2 = 0.0;
        }

        
        fragColor = vec4(vec3(50 / 255.0, 48 / 255.0, 40 / 255.0), 1)
        + vec4(vec3(253 / 255.0, 243 / 255.0, 198 / 255.0) * cosTheta / pow(distToLight, 2.0) * lightIntensity, 1) + vec4(vec3(253 / 255.0, 100 / 255.0, 100 / 255.0) * cosTheta2 / pow(distToLight2, 2.0) * lightIntensity2, 1);
    } else {
        fragColor = vec4(0 / 255.0, 0 / 255.0, 0 / 255.0, 1);
    }
    
}