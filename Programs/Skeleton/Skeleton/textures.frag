#version 330 core

struct Material {
	vec3 ka, kd, ks;
	float  shininess;
};

struct Light {
	vec3 direction;
	vec3 Le, La;
};

struct Hit {
	float t;
	vec3 position, normal;
	Material mat;
};

struct Ray {
	vec3 start, dir;
};

const float PI = 3.141592654;

in vec2 texCoord;
uniform float frame;
uniform mat4 camDirMat;

out vec4 fragColor;

vec3 movingLightPos;

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

Hit calcHit(Hit hit1, Hit hit2){
    Hit hit;
	hit.t = -1;

    if (hit1.t < 0.0 && hit2.t < 0.0) {
       hit.t = -1;
    } else if ( hit2.t < 0.0) {
        hit = hit1;
    } else if ( hit1.t < 0.0) {
        hit = hit2;
    } else {
        if (hit1.t < hit2.t) {
            hit = hit1;
        } else {
            hit = hit2;
        }
    }
    return hit;
}

Hit intersectSphere(vec3 center, float radius, const Ray ray) {
    Hit hit;
	hit.t = -1;
    vec3 dist = ray.start - center;
    float a = dot(ray.dir, ray.dir);
    float b = dot(dist, ray.dir) * 2.0;
    float c = dot(dist, dist) - radius * radius;
    float discr = b * b - 4.0f * a * c;
    if (discr < 0.0) {
        return hit;
    }
    
    hit.t = (-b - sqrt(discr)) / 2.0 / a;
    hit.position = ray.start + ray.dir * hit.t;
    
    hit.normal = (hit.position - center) / radius;
	return hit;
}

// formula:https://nmd.pages.math.illinois.edu/quadrics/ellparab.html (switched y and z axis +  quadratic equation)
Hit intersectParaboloid(vec3 focus, float size, float height, const Ray ray) {
    Hit hit;
	hit.t = -1;

    float a = dot(vec2(ray.dir.x / size, ray.dir.z / size), vec2(ray.dir.x / size, ray.dir.z / size));
    float b = dot(2.0 * vec2(ray.start.x / size, ray.start.z / size), vec2(ray.dir.x / size, ray.dir.z / size)) - ray.dir.y;
    float c = dot(vec2(ray.start.x / size, ray.start.z / size), vec2(ray.start.x / size, ray.start.z / size)) - ray.start.y;
    float discr = b * b - 4 * a * c;
    if (discr < 0.0) {
        return hit;
    }
    Hit hit1;
    Hit hit2;
    hit1.t = (-b - sqrt(discr)) / (2 * a);
    hit2.t = (-b + sqrt(discr)) / (2 * a);
    hit1.position = ray.start + ray.dir * hit1.t;
    hit2.position = ray.start + ray.dir * hit2.t;
    if (hit1.position.y > height + focus.y){
       hit1.t = -1.0;
    }
    if (hit2.position.y > height + focus.y){
       hit2.t = -1.0;
    }
    hit = calcHit(hit1, hit2);

    hit.normal = cross(vec3(1, 2 * hit.position.x, 0),vec3(0, 2 * hit.position.z ,1));
    hit.normal = normalize(hit.normal);

    return hit;
}

Hit intersectCylinder(vec3 center, float radius, float height,  const Ray ray) {
    Hit hit;
	hit.t = -1;

    vec2 dist = vec2(ray.start.x, ray.start.z) - vec2(center.x, center.z);
    float a = dot(vec2(ray.dir.x, ray.dir.z), vec2(ray.dir.x, ray.dir.z));
    float b = 2.0 * dot(dist, vec2(ray.dir.x, ray.dir.z));
    float c = dot(dist, dist) - radius * radius;
    float discr = b * b - 4 * a * c;
    if (discr < 0.0) {
        return hit;
    }
    Hit hit1;
    Hit hit2;
    hit1.t = (-b - sqrt(discr)) / 2.0 / a;
    hit2.t = (-b + sqrt(discr)) / 2.0 / a;
    hit1.position = ray.start + ray.dir * hit1.t;
    hit2.position = ray.start + ray.dir * hit2.t;
    if (hit1.position.y < center.y || hit1.position.y > height + center.y){
        hit1.t = -1.0;
    }
    if (hit2.position.y < center.y || hit2.position.y > height + center.y){
        hit2.t = -1.0;
    }
    
    hit = calcHit(hit1, hit2);
    
    hit.normal = hit.position - center;
    hit.normal.y = 0.0;
    hit.normal = normalize(hit.normal);

    return hit;
}

Hit intersectPlane(vec3 point, vec3 normal, const Ray ray) {
    Hit hit;
    hit.t = -1;
    hit.t = dot(point - ray.start, normal) / dot(ray.dir, normal);
    hit.position = ray.start + ray.dir * hit.t;
    hit.normal = normal;
    return hit;
}

Hit intersectCircle(vec3 center, float radius, vec3 normal, const Ray ray) {
    Hit hit = intersectPlane(center, normal, ray);
    //formula: https://www.mathcentre.ac.uk/resources/uploaded/mc-ty-circles-2009-1.pdf
    if (hit.position.x * hit.position.x + hit.position.z * hit.position.z > radius * radius) {
        hit.t = -1;
    }
    return hit;
}

Hit merge(Hit hit1, Hit hit2) {
    Hit hit;
    hit.t = -1.0;
    if (hit1.t < 0.0 && hit2.t < 0.0){ 
        return hit;
    }
    if (hit2.t< 0.0) {
        return hit1;
    } 
    if (hit1.t < 0.0) {
        return hit2;
    } 
    if (hit1.t < hit2.t) {
        return hit1;
    } 
    return hit2;
} 

Hit intersectAll(Ray ray) {
    float time = frame / 100.0;

    Material material1;
    material1.kd = vec3(0.3, 0.2, 0.1);
    material1.ka = vec3(0.3, 0.2, 0.1) * PI; 
    material1.ks = vec3(10, 10, 10);
	material1.shininess = 50;

    Material material2;
    material2.kd = vec3(5 / 255.0, 5 / 255.0, 100 / 255.0);
    material2.ka = vec3(0.3, 0.2, 0.1) * PI; 
    material2.ks = vec3(5, 5, 5);
	material2.shininess = 50;

    Hit ground = intersectPlane(vec3(0, 0, 0), vec3(0, 1, 0), ray);
    ground.mat = material1;

    Hit base = intersectCylinder(vec3(0, 0, 0), 1.0, 0.2, ray);
    base.mat = material2;

    Hit baseTop = intersectCircle(vec3(0, 0.2, 0), 1, vec3(0, 1, 0), ray);
    baseTop.mat = material2;

    Hit sphereJoint1 = intersectSphere(vec3(0, 0.2, 0), 0.2, ray);
    sphereJoint1.mat = material2;

    //rotate the first rod 
    vec4 q = quat(normalize(vec3(1, 6, 3)), time);
    Ray ray1;
    ray1.start = quatRot(q, ray.start + vec3(0,-0.2,0));
    ray1.dir = quatRot(q, ray.dir);
    
    Hit rod1 = intersectCylinder(vec3(0, 0, 0), 0.11, 3.0, ray1);
    rod1.mat = material2;
    rod1.normal = quatRot(quatInv(q), rod1.normal);
    

    Hit sphereJoint2 = intersectSphere(vec3(0, 3, 0), 0.2, ray1);
    sphereJoint2.mat = material2;
    sphereJoint2.normal = quatRot(quatInv(q), sphereJoint2.normal);

    //rotate the second rod 
    vec4 q2 = quat(normalize(vec3(2, 3, 4)), time + 1.5);
    Ray ray2;
    ray2.start = quatRot(q2, ray1.start + vec3(0,-3.0,0));
    ray2.dir  = quatRot(q2, ray1.dir);


    Hit rod2 = intersectCylinder(vec3(0, 0, 0), 0.11, 2.0, ray2);
    rod2.mat = material2;
    rod2.normal = quatRot(quatInv(q2), rod2.normal);
    rod2.normal = quatRot(quatInv(q), rod2.normal);


    Hit sphereJoint3 = intersectSphere(vec3(0, 2, 0), 0.2, ray2);
    sphereJoint3.mat = material2;
    sphereJoint3.normal = quatRot(quatInv(q2), sphereJoint3.normal);
    sphereJoint3.normal = quatRot(quatInv(q), sphereJoint3.normal);

    //rotate the lamp shade 
    vec4 q3 = quat(normalize(vec3(4, 1, 1)), 7.5);
    Ray ray3;
    ray3.start = quatRot(q3, ray2.start + vec3(0,-2.0,0));
    ray3.dir = quatRot(q3, ray2.dir);

    vec4 q4 = quat(normalize(vec3(1, 4, 1)), time);
    Ray ray4;
    ray4.start = quatRot(q4, ray3.start);
    ray4.dir = quatRot(q4, ray3.dir);

    Hit lampShade = intersectParaboloid(vec3(0, 0, 0), 0.8, 1.0, ray4);
    lampShade.mat = material2;
    lampShade.normal = quatRot(quatInv(q4), lampShade.normal);
    lampShade.normal = quatRot(quatInv(q3), lampShade.normal);
    lampShade.normal = quatRot(quatInv(q2), lampShade.normal);
    lampShade.normal = quatRot(quatInv(q), lampShade.normal);

    
    Hit hit;
    hit = merge(ground, base);
    hit = merge(hit, baseTop);
    hit = merge(hit, sphereJoint1);
    hit = merge(hit, rod1);
    hit = merge(hit, sphereJoint2);
    hit = merge(hit, rod2);
    hit = merge(hit, sphereJoint3);
    hit = merge(hit, lampShade);

    //movingLightPos = vec3(0, 10, 0);
    movingLightPos = vec3(0, 0.2, 0);
    movingLightPos += quatRot(quatInv(q), vec3(0,3,0));

    //movingLightPos += vec3(0, 0.3, 0);
    return hit;
}

bool shadowIntersect(Ray ray) {	// for directional lights
		if (intersectAll(ray).t > 0) return true; //  hit.t < 0 if no intersection
		return false;
}

void main() {
    Light light1;
    Light light2;

    light1.Le = vec3(3, 3, 3);
    light2.Le = vec3(3, 3, 3);
    light1.La = vec3(0.4, 0.3, 0.3);
    light2.La = vec3(0.4, 0.3, 0.3);

    float time = frame / 100.0;
    float fov = PI / 2;

    Ray ray;
    ray.start = vec3(0, 6, 5); //~ cam pos
    ray.dir = normalize(vec3(texCoord * 2 - 1, -tan(fov / 2.0)));
    ray.dir = (vec4(ray.dir, 0) * camDirMat).xyz;

    Hit hit = intersectAll(ray);
    hit.position = ray.start + ray.dir * hit.t;


    light1.direction = vec3(10,15,10);
    light2.direction = movingLightPos;

    if (dot(hit.normal, ray.dir) > 0.0) {
        hit.normal *= -1;
    }
    
    Ray ray1;
    Ray ray2;
    ray1.dir = light1.direction - hit.position;
    ray2.dir = light2.direction - hit.position;

    float lightDistance1 = length(ray1.dir);
    float lightDistance2 = length(ray2.dir);
    
    ray1.dir /= lightDistance1;
    ray2.dir /= lightDistance2;
    
    if (hit.t > 0.0) {
        const float epsilon = 0.0001;
        
        ray1.start = hit.position + hit.normal * epsilon;
  
        ray2.start = hit.position + hit.normal * epsilon;


        Hit lightHit1 = intersectAll(ray1);
        Hit lightHit2 = intersectAll(ray2);

        float lightIntensity = 50.0;
        float lightIntensity2 = 30.0;

        if (lightHit1.t > 0.0) {
            lightIntensity = 0.0;
        }
        
        if (lightHit2.t > 0.0) {
            lightIntensity2 = 0.0;
        }
        
        vec3 weight = vec3(1, 1, 1);
        vec3 outRadiance = vec3(0, 0, 0);
        
        //outRadiance += weight * hit.mat.ka * light1.La;
		Ray shadowRay1;

		shadowRay1.start = hit.position + hit.normal * epsilon;
		shadowRay1.dir = light1.direction;
		float cosTheta1 = dot(hit.normal, light1.direction);
		if (cosTheta1 > 0 && !shadowIntersect(shadowRay1)) {
            outRadiance += weight * light1.Le * hit.mat.kd * cosTheta1;
            vec3 halfway1 = normalize(-ray.dir + light1.direction);
            float cosDelta1 = dot(hit.normal, halfway1);
            if (cosDelta1 > 0){
                outRadiance += weight * light1.Le * hit.mat.ks * pow(cosDelta1, hit.mat.shininess);
            }
        }

        //outRadiance += weight * hit.mat.ka * light2.La;	
        Ray shadowRay2;

        shadowRay2.start = hit.position + hit.normal * epsilon;
		shadowRay2.dir = light1.direction;
        float cosTheta2 = dot(hit.normal, light1.direction);
		if (cosTheta2 > 0 && !shadowIntersect(shadowRay1)) {
            outRadiance += weight * light2.Le * hit.mat.kd * cosTheta2;
            vec3 halfway2 = normalize(-ray.dir + light2.direction);
            float cosDelta2 = dot(hit.normal, halfway2);
            if (cosDelta2 > 0){
                outRadiance += weight * light2.Le * hit.mat.ks * pow(cosDelta2, hit.mat.shininess);
            }
        }
        fragColor = vec4(outRadiance, 1);
        // fragColor = vec4(vec3(50 / 255.0, 48 / 255.0, 40 / 255.0), 1)
        // + vec4(vec3(253 / 255.0, 100 / 255.0, 100 / 255.0) * cosTheta2 / pow(lightDistance2, 2.0) * lightIntensity2, 1);
    
    } else {
        fragColor = vec4(0 / 255.0, 0 / 255.0, 0 / 255.0, 1);
    }
}


				

//vec4(vec3(253 / 255.0, 243 / 255.0, 198 / 255.0) * cosTheta1 / pow(lightDistance1, 2.0) * lightIntensity, 1) + 
