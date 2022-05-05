#version 330 core

const float PI = 3.141592654;

in vec2 texCoord;
uniform float frame;
uniform mat4 viewMat;

out vec4 fragColor;

vec4 quat(vec3 rotAxis, float rotAangle) {
    return vec4(rotAxis * sin(rotAangle / 2), cos(rotAangle / 2));
}

vec4 quatInv(vec4 quat) {
    return vec4(-quat.x,-quat.y, -quat.z, quat.w);
}

vec4 quatMul(vec4 q1, vec4 q2) {
    return vec4(
        q1.w * vec3(q2.x, q2.y, q2.z) + q2.w * vec3(q1.x, q1.y, q1.z) + cross(vec3(q1.x, q1.y, q1.z), vec3(q2.x, q2.y, q2.z)),
        q1.w * q2.w - dot(vec3(q1.x, q1.y, q1.z), vec3(q2.x, q2.y, q2.z))
    );
}

vec3 quatRot(vec4 q, vec3 p) {
    return quatMul(quatMul(q, vec4(p, 0)), quatInv(q)).xyz;
}

float intersectSphere(vec3 rayOrigin, vec3 rayDir, vec3 center, float radius, out vec3 normal) {
    vec3 oc = rayOrigin - center;
    float a = dot(rayDir, rayDir);
    float b = 2.0 * dot(oc, rayDir);
    float c = dot(oc, oc) - radius * radius;
    float disc = b * b - 4 * a * c;
    if (disc < 0.0) {
        return -1.0;
    }
    float t = (-b - sqrt(disc)) / (2 * a);
    vec3 hitPos = rayOrigin + rayDir * t;
    
    normal = normalize(hitPos - center);
    return t;
}

float intersectParaboloid(vec3 rayOrigin, vec3 rayDir, vec3 center, float radius, float height, out vec3 normal) {
    vec2 oc = rayOrigin.xz - center.xz;
    float a = dot(rayDir.xz, rayDir.xz);
    float b = dot(2.0 * rayOrigin.xz, rayDir.xz) - rayDir.y;
    float c = dot(rayOrigin.xz, rayOrigin.xz) - rayOrigin.y;
    float disc = b * b - 4 * a * c;
    if (disc < 0.0) {
        return -1.0;
    }
    float t1 = (-b - sqrt(disc)) / (2 * a);
    float t2 = (-b + sqrt(disc)) / (2 * a);
    vec3 hitPos1 = rayOrigin + rayDir * t1;
    vec3 hitPos2 = rayOrigin + rayDir * t2;
    if (hitPos1.y > height + center.y)
        t1 = -1.0;
    if (hitPos2.y > height + center.y)
        t2 = -1.0;
    
    float t;
    vec3 hitPos;
    if (t1 < 0.0 && t2 < 0.0) {
        t = -1.0;
    } else if (t2 < 0.0) {
        t = t1;
        hitPos = hitPos1;
    } else if (t1 < 0.0) {
        t = t2;
        hitPos = hitPos2;
    } else {
        if (t1 < t2) {
            t = t1;
            hitPos = hitPos1;
        } else {
            t = t2;
            hitPos = hitPos2;
        }
    }
    
    normal = hitPos - center;
    //normal.y = 0.0;
    normal = normalize(normal);
        
    return t;
}

float intersectCylinder(vec3 rayOrigin, vec3 rayDir, vec3 center, float radius, float height, out vec3 normal) {
    vec2 oc = rayOrigin.xz - center.xz;
    float a = dot(rayDir.xz, rayDir.xz);
    float b = 2.0 * dot(oc, rayDir.xz);
    float c = dot(oc, oc) - radius * radius;
    float disc = b * b - 4 * a * c;
    if (disc < 0.0) {
        return -1.0;
    }
    float t1 = (-b - sqrt(disc)) / (2 * a);
    float t2 = (-b + sqrt(disc)) / (2 * a);
    vec3 hitPos1 = rayOrigin + rayDir * t1;
    vec3 hitPos2 = rayOrigin + rayDir * t2;
    if (hitPos1.y < center.y || hitPos1.y > height + center.y)
        t1 = -1.0;
    if (hitPos2.y < center.y || hitPos2.y > height + center.y)
        t2 = -1.0;
    
    float t;
    vec3 hitPos;
    if (t1 < 0.0 && t2 < 0.0) {
        t = -1.0;
    } else if (t2 < 0.0) {
        t = t1;
        hitPos = hitPos1;
    } else if (t1 < 0.0) {
        t = t2;
        hitPos = hitPos2;
    } else {
        if (t1 < t2) {
            t = t1;
            hitPos = hitPos1;
        } else {
            t = t2;
            hitPos = hitPos2;
        }
    }
    
    normal = cross(vec3(1, 2 * hitPos.x, 0),vec3(0, 2 * hitPos.z ,1));
    normal = normalize(normal);
        
    return t;
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

float combine(float t1, float t2, vec3 normal1, vec3 normal2, out vec3 normal) {
    float t;
    if (t1 < 0.0 && t2 < 0.0) {
        return -1.0;
    } else if (t2 < 0.0) {
        normal = normal1;
        return t1;
    } else if (t1 < 0.0) {
        normal = normal2;
        return t2;
    } else {
        if (t1 < t2) {
            normal = normal1;
            return t1;
        } else {
            normal = normal2;
            return t2;
        }
    }
} 

float intersectWorld(vec3 rayOrigin, vec3 rayDir, out vec3 normal) {
    float time = frame / 60.0;
    vec3 baseNormal;
    vec3 baseTopNormal = vec3(0, 1, 0);
    vec3 rod1Normal;
    vec3 sphereJoint1Normal;
    vec3 groundNormal = vec3(0, 1, 0);

    float tGround = intersectPlane(rayOrigin, rayDir, vec3(0, 0, 0), groundNormal);

    float tBase = intersectCylinder(rayOrigin, rayDir, vec3(0, 0, 0), 1.0, 0.2, baseNormal);

    float tBaseTop = intersectCircle(rayOrigin, rayDir, vec3(0, 0.2, 0), 1, baseTopNormal);

    float tSphereJoint1 = intersectSphere(rayOrigin, rayDir, vec3(0, 0.2, 0), 0.3, sphereJoint1Normal);
    
    //rotate the first rod 
    vec4 q = quat(normalize(vec3(1, 6, 3)), time);
    vec3 rotOrigin1 = quatRot(q, rayOrigin + vec3(0,-0.2,0));
    vec3 rotRayDir1 = quatRot(q, rayDir);
    
    float rod1 = intersectCylinder(rotOrigin1, rotRayDir1, vec3(0, 0, 0), 0.2, 2.0, rod1Normal);
    rod1Normal = quatRot(quatInv(q), rod1Normal);
    
    vec3 sphereJoint2Normal;
    float tSphereJoint2 = intersectSphere(rotOrigin1, rotRayDir1, vec3(0, 2, 0), 0.3, sphereJoint2Normal);
    sphereJoint2Normal = quatRot(quatInv(q), sphereJoint2Normal);

    //rotate the second rod 
    vec4 q2 = quat(normalize(vec3(2, 3, 4)), time + 1.5);
    vec3 rotOrigin2 = quatRot(q2, rotOrigin1 + vec3(0,-2.0,0));
    vec3 rotRayDir2 = quatRot(q2, rotRayDir1);

    vec3 rod2Normal;
    float rod2 = intersectCylinder(rotOrigin2, rotRayDir2, vec3(0, 0, 0), 0.2, 2.0, rod2Normal);
    rod2Normal = quatRot(quatInv(q2), rod2Normal);
    rod2Normal = quatRot(quatInv(q), rod2Normal);

    vec3 sphereJoint3Normal;
    float tSphereJoint3 = intersectSphere(rotOrigin2, rotRayDir2, vec3(0, 2, 0), 0.3, sphereJoint3Normal);
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
    float tLampShade = intersectParaboloid(rotOrigin4, rotRayDir4, vec3(0, 0, 0), 0.2, 1.0, lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q4), lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q3), lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q2), lampShadeNormal);
    lampShadeNormal = quatRot(quatInv(q), lampShadeNormal);

    float t;
    t = combine(tGround, tBase, groundNormal, baseNormal, normal);
    t = combine(t, tBaseTop, normal, baseTopNormal, normal);
    t = combine(t, tSphereJoint1, normal, sphereJoint1Normal, normal);
    t = combine(t, rod1, normal, rod1Normal, normal);
    t = combine(t, tSphereJoint2, normal, sphereJoint2Normal, normal);
    t = combine(t, rod2, normal, rod2Normal, normal);
    t = combine(t, tSphereJoint3, normal, sphereJoint3Normal, normal);
    t = combine(t, tLampShade, normal, lampShadeNormal, normal);
    return t;
}

void main() {
    float time = frame / 60.0;
    vec3 lightPos = vec3(0,10,0);
    
    float fov = PI / 2;
    
    vec3 rayOrigin = vec3(0, 2.5, 5); //~ cam pos
    vec3 rayDir = normalize(vec3(texCoord * 2 - 1, -tan(fov / 2.0)));
    
    vec3 normal;
    float t = intersectWorld(rayOrigin, rayDir, normal);
    
    if (dot(normal, rayDir) > 0.0) {
        normal *= -1;
    }
    
    vec3 hitPos = rayOrigin + rayDir * t;
    vec3 toLight = lightPos - hitPos;
    float distToLight = length(toLight);
    toLight /= distToLight;
    if (t > 0.0) {
        float cosTheta = max(dot(toLight, normal), 0.0);
        vec3 _;
        float lightT = intersectWorld(hitPos + normal * 0.0001, toLight, _);
        float lightIntensity = 40.0;
        if (lightT > 0.0) {
            lightIntensity = 0.0;
        }
        
        fragColor = vec4(vec3(253 / 255.0, 243 / 255.0, 198 / 255.0) * cosTheta / pow(distToLight, 2.0) * lightIntensity, 1);
    } else {
        fragColor = vec4(135 / 255.0, 206 / 255.0, 235 / 255.0, 1);
    }
    
}
