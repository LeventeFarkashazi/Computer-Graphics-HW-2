//=============================================================================================
// Mintaprogram: Zöld háromszög. Ervenyes 2019. osztol.
//
// A beadott program csak ebben a fajlban lehet, a fajl 1 byte-os ASCII
// karaktereket tartalmazhat, BOM kihuzando. Tilos:
// - mast "beincludolni", illetve mas konyvtarat hasznalni
// - faljmuveleteket vegezni a printf-et kiveve
// - Mashonnan atvett programresszleteket forrasmegjeloles nelkul felhasznalni
// es
// - felesleges programsorokat a beadott programban hagyni!!!!!!!
// - felesleges kommenteket a beadott programba irni a forrasmegjelolest
// kommentjeit kiveve
// ---------------------------------------------------------------------------------------------
// A feladatot ANSI C++ nyelvu forditoprogrammal ellenorizzuk, a Visual
// Studio-hoz kepesti elteresekrol es a leggyakoribb hibakrol (pl. ideiglenes
// objektumot nem lehet referencia tipusnak ertekul adni) a hazibeado portal ad
// egy osszefoglalot.
// ---------------------------------------------------------------------------------------------
// A feladatmegoldasokban csak olyan OpenGL fuggvenyek hasznalhatok, amelyek az
// oran a feladatkiadasig elhangzottak A keretben nem szereplo GLUT fuggvenyek
// tiltottak.
//
// NYILATKOZAT
// ---------------------------------------------------------------------------------------------
// Nev    : Farkashazi Levente
// Neptun : HFDKFC
// ---------------------------------------------------------------------------------------------
// ezennel kijelentem, hogy a feladatot magam keszitettem, es ha barmilyen
// segitseget igenybe vettem vagy mas szellemi termeket felhasznaltam, akkor a
// forrast es az atvett reszt kommentekben egyertelmuen jeloltem. A
// forrasmegjeloles kotelme vonatkozik az eloadas foliakat es a targy oktatoi,
// illetve a grafhazi doktor tanacsait kiveve barmilyen csatornan (szoban,
// irasban, Interneten, stb.) erkezo minden egyeb informaciora (keplet, program,
// algoritmus, stb.). Kijelentem, hogy a forrasmegjelolessel atvett reszeket is
// ertem, azok helyessegere matematikai bizonyitast tudok adni. Tisztaban vagyok
// azzal, hogy az atvett reszek nem szamitanak a sajat kontribucioba, igy a
// feladat elfogadasarol a tobbi resz mennyisege es minosege alapjan szuletik
// dontes. Tudomasul veszem, hogy a forrasmegjeloles kotelmenek megsertese
// eseten a hazifeladatra adhato pontokat negativ elojellel szamoljak el es
// ezzel parhuzamosan eljaras is indul velem szemben. A megoldas elkezdeseben
// felhasznaltam a konzultacio egyes reszleteit, amiket teljes mertekben atirtam.
//=============================================================================================
#include "framework.h"

const char *const vertexSource = R"(
    #version 330				
	precision highp float;		

    in vec4 vertexPos;

    out vec2 texCoord;

    void main() {
        gl_Position = vertexPos;
        texCoord = vertexPos.xy * 0.5 + 0.5;
    }
)";

const char *const fragmentSource = R"(
    #version 330 core
    precision highp float;	

    struct Material {
	    vec3 ka, kd, ks;
	    float  shininess;
    };

    struct Light {
	    vec3 direction;
	    vec3 Le;
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

    vec4 quatMul(vec4 q1, vec4 q2) {
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
        material1.kd = vec3(77 / 255.0, 13 / 255.0, 13 / 255.0) * 0.5;
        material1.ka = material1.kd * PI; 
        material1.ks = vec3(2, 2, 2);
	    material1.shininess = 1000000000;

        Material material2;
        material2.kd = vec3(5 / 255.0, 5 / 255.0, 100 / 255.0) * 0.3;
        material2.ka = material2.kd * PI; 
        material2.ks = vec3(2, 2, 2);
	    material2.shininess = 500;

        Hit ground = intersectPlane(vec3(0, 0, 0), vec3(0, 1, 0), ray);
        ground.mat = material1;

        Hit base = intersectCylinder(vec3(0, 0, 0), 1.0, 0.2, ray);
        base.mat = material2;

        Hit baseTop = intersectCircle(vec3(0, 0.2, 0), 1, vec3(0, 1, 0), ray);
        baseTop.mat = material2;

        Hit sphereJoint1 = intersectSphere(vec3(0, 0.2, 0), 0.2, ray);
        sphereJoint1.mat = material2;

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

        vec4 q2 = quat(normalize(vec3(2, 3, 4)), -time + 1.5);
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

        vec4 q3 = quat(normalize(vec3(4, 1, 1)), 7.5);
        Ray ray3;
        ray3.start = quatRot(q3, ray2.start + vec3(0,-2.0,0));
        ray3.dir = quatRot(q3, ray2.dir);

        vec4 q4 = quat(normalize(vec3(1, 4, 1)), 0.5*time);
        Ray ray4;
        ray4.start = quatRot(q4, ray3.start);
        ray4.dir = quatRot(q4, ray3.dir);

        Hit lampShade = intersectParaboloid(vec3(0, 0, 0), 0.9, 1.0, ray4);
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

        movingLightPos = vec3(0, 0.2, 0);
        movingLightPos += quatRot(quatInv(q), vec3(0,3,0));
        movingLightPos += quatRot(quatMul(quatInv(q), quatInv(q2)), vec3(0,2,0));
        movingLightPos += quatRot(quatMul(quatMul(quatInv(q), quatInv(q2)),quatInv(q3)) ,vec3(0,0,0));
        movingLightPos += quatRot(quatMul(quatMul(quatMul(quatInv(q), quatInv(q2)),quatInv(q3)),quatInv(q4)) ,vec3(0,0.25,0));
    
        if (dot(ray.dir, hit.normal) > 0) hit.normal = hit.normal * (-1);

        return hit;
    }

    vec3 La = vec3(50 / 255.0, 48 / 255.0, 40 / 255.0);

    void main() {
        Light light1;
        light1.Le = vec3(2, 2, 2);
        Light light2;
        light2.Le = vec3(2, 2, 2);

        float time = frame / 100.0;
        float fov = PI / 2;

        Ray ray;
        ray.start = vec3(0, 6, 5);
        ray.dir = normalize(vec3(texCoord * 2 - 1, -tan(fov / 2.0)));
        ray.dir = (vec4(ray.dir, 0) * camDirMat).xyz;

        Hit hit = intersectAll(ray);
        hit.position = ray.start + ray.dir * hit.t;


        light1.direction = vec3(15,15,10);
        light2.direction = movingLightPos;
    
        Ray ray1;
        Ray ray2;

        float lightDistance1 = length(light1.direction - hit.position);
        float lightDistance2 = length(light2.direction - hit.position);
    
        ray1.dir = normalize(light1.direction - hit.position);
        ray2.dir = normalize(light2.direction - hit.position);
    
        if (hit.t > 0.0) {
            float cosTheta1 = max(dot(ray1.dir, hit.normal), 0.0);
            float cosTheta2 = max(dot(ray2.dir, hit.normal), 0.0);

            const float epsilon = 0.0001;
        
            ray1.start = hit.position + hit.normal * epsilon;
            ray2.start = hit.position + hit.normal * epsilon;

            Hit lightHit1 = intersectAll(ray1);
            Hit lightHit2 = intersectAll(ray2);

            float lightIntensity1 = 50.0;
            float lightIntensity2 = 40.0;

            if (lightHit1.t > 0.0 && lightHit1.t < lightDistance1) {
                lightIntensity1 = 0.0;
            }
        
            if (lightHit2.t > 0.0 && lightHit2.t < lightDistance2) {
                lightIntensity2 = 0.0;
            }
        
            vec3 halfway = normalize(-ray1.dir + light1.direction);
		    float cosDelta = dot(hit.normal, halfway);

            vec3 outRadiance = vec3(0,0,0);
            outRadiance += hit.mat.ka * La * 0.01;
            outRadiance += vec3(253 / 255.0, 243 / 255.0, 198 / 255.0) * cosTheta1 / pow(lightDistance1, 2.0) * lightIntensity1; 
            outRadiance += vec3(248 / 255.0, 235 / 255.0, 100 / 255.0) * cosTheta2 / pow(lightDistance2, 2.0) * lightIntensity2;
        
            outRadiance += light1.Le * hit.mat.kd * cosTheta1;
            vec3 halfway1 = normalize(-ray1.dir + light1.direction);
		    float cosDelta1 = dot(hit.normal, halfway1);
            outRadiance += light1.Le * hit.mat.ks * pow(cosDelta1, hit.mat.shininess);

            outRadiance += light2.Le * hit.mat.kd * cosTheta2;
            vec3 halfway2 = normalize(-ray2.dir + light2.direction);
		    float cosDelta2 = dot(hit.normal, halfway2);
            outRadiance += light2.Le * hit.mat.ks * pow(cosDelta2, hit.mat.shininess);
        
            fragColor = vec4(outRadiance, 1);
        } else {
            fragColor = vec4(0 / 255.0, 0 / 255.0, 0 / 255.0, 1);
        }
    }

)";

GPUProgram gpuProgram;  
unsigned int vao;       
int frame = 0;

void onInitialization() {
  glViewport(0, 0, windowWidth, windowHeight);

  glGenVertexArrays(1, &vao); 
  glBindVertexArray(vao);      

  unsigned int vbo;       
  glGenBuffers(1, &vbo);  
  glBindBuffer(GL_ARRAY_BUFFER, vbo);
  
  float vertices[] = {-1.0f, -1.0f, 1.0f, -1.0f, -1.0f, 1.0f, 1.0f, 1.0f};
  glBufferData(GL_ARRAY_BUFFER,   
               sizeof(vertices),  
               vertices,        
               GL_STATIC_DRAW);   

  glEnableVertexAttribArray(0);  
  glVertexAttribPointer(0,       
                        2, GL_FLOAT,
                        GL_FALSE,  
                        0, NULL);  

  gpuProgram.create(vertexSource, fragmentSource, "outColor");
}


void onDisplay() {
  glClearColor(0, 0, 0, 0);     
  glClear(GL_COLOR_BUFFER_BIT); 

  gpuProgram.setUniform((float)frame, "frame");
  gpuProgram.setUniform((mat4)RotationMatrix(-0.9f, vec3(1,0,0)), "camDirMat");
  frame++;

  glBindVertexArray(vao);                 
  glDrawArrays(GL_TRIANGLE_STRIP, 0, 4); 

  glutSwapBuffers();  
}

void onKeyboard(unsigned char key, int pX, int pY) {}

void onKeyboardUp(unsigned char key, int pX, int pY) {}

void onMouseMotion(int pX, int pY) {}

void onMouse(int button, int state, int pX, int pY) {
}

void onIdle() {
  long time = glutGet(
      GLUT_ELAPSED_TIME);
  glutPostRedisplay();
}
