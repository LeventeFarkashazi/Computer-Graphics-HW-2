#version 330 core

const float PI = 3.141592654;

in vec2 texCoord;
uniform float frame;
uniform mat4 viewMat;

out vec4 fragColor;

vec4 quat(vec3 axis, float angle) {
    return vec4(axis * sin(angle / 2), cos(angle / 2));
}

vec4 quatInv(vec4 q) {
    return vec4(-q.x,-q.y, -q.z, q.w);
}

vec4 quatMul(vec4 q1, vec4 q2) {
    return vec4(
        q1.w * vec3(q2.x, q2.y, q2.z) + q2.w * vec3(q1.x, q1.y, q1.z) + cross(vec3(q1.x, q1.y, q1.z), vec3(q2.x, q2.y, q2.z)),
        q1.w * q2.w - dot(vec3(q1.x, q1.y, q1.z), vec3(q2.x, q2.y, q2.z))
    );
}

vec3 quatRot(vec4 q, vec3 p) {
    vec4 qInv = quatInv(q);
    return quatMul(quatMul(q, vec4(p, 0)), qInv).xyz;
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
    
    normal = hitPos - center;
    normal.y = 0.0;
    normal = normalize(normal);
        
    return t;
}

float intersectPlane(vec3 rayOrigin, vec3 rayDir, vec3 point, vec3 normal) {
    return dot(point - rayOrigin, normal) / dot(rayDir, normal);
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
    vec3 cylNormal;
    vec3 sphNormal;
    
    float tSph = intersectSphere(rayOrigin, rayDir, vec3(0, 0, 0), 0.5, sphNormal);
    vec3 planeNormal = vec3(0, 1, 0);
    float tPlane = intersectPlane(rayOrigin, rayDir, vec3(0, -2, 0), planeNormal);
    
    vec4 q = quat(normalize(vec3(1, 3, 2)), time);
    vec3 rotOrigin = quatRot(q, rayOrigin);
    vec3 rotRayDir = quatRot(q, rayDir);
    float tCyl = intersectCylinder(rotOrigin, rotRayDir, vec3(0, 0, 0), 0.4, 2.0, cylNormal);
    cylNormal = quatRot(quatInv(q), cylNormal);
    
    vec3 sph2Normal;
    float tSph2 = intersectSphere(rotOrigin, rotRayDir, vec3(0, 2, 0), 0.5, sph2Normal);
    sph2Normal = quatRot(quatInv(q), sph2Normal);
    
    float t = combine(tCyl, tSph, cylNormal, sphNormal, normal);
    t = combine(t, tSph2, normal, sph2Normal, normal);

    return combine(t, tPlane, normal, planeNormal, normal);
}

void main() {
    float time = frame / 60.0;
    vec3 lightPos = vec3(cos(time) * 5.0, 5, sin(time) * 5.0);
    
    float fov = PI / 2;
    
    vec3 rayOrigin = vec3(0, 2.5, 5); //~ cam pos
    vec3 rayDir = normalize(vec3(texCoord * 2 - 1, -tan(fov / 2.0)));
    //rayDir = (vec4(rayDir, 0) * viewMat).xyz;
    
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
        
        fragColor = vec4(vec3(1, 0, 0) * cosTheta / pow(distToLight, 2.0) * lightIntensity, 1);
    } else {
        fragColor = vec4(0, 0, 0, 1);
    }
    
}