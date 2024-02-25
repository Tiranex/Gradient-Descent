import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import { TextGeometry } from './lib/TextGeometry.js';
import { FontLoader } from './lib/FontLoader.js';

let renderer, scene, camera;
let pointclouds;
let raycaster;
let intersection = null;
let controls;

let path = [];
let current_index = 1;

const pointer = new THREE.Vector2();
let sphere;

const threshold = 0.1;
const pointSize = 0.05;
const width = 150;
const length = 150;

const red = new THREE.Color(0xff0000);
const blue = new THREE.Color(0x00ff00);
const green = new THREE.Color(0x0000ff);

/* Input Handle */
const set_point_button = document.getElementById('set_point_button');
let set_point = false;
set_point_button.addEventListener('click', function(){
    dispose_path();
    set_point = true;
})


const selectButtons = document.getElementsByClassName('control_button');

for (let i = 0; i < selectButtons.length; i++) {
    selectButtons[i].addEventListener('click', function() {
       current_index = parseInt(selectButtons[i].value)
        // Remove object
        dispose_path();
        sphere.scale.set(0,0,0);
        pointclouds.geometry = generatePointCloudGeometry(width, length, ...functions[current_index]);

    });
}


init();
animate();


function getGradientColor(value, color1 = red, color2 = blue) {
    value = Math.max(0, Math.min(1, value));
    const gradientColor = new THREE.Color();
    gradientColor.copy(red).lerp(blue, value);

    return gradientColor;
}

function generatePointCloudGeometry(width, length, f, start=-10, end=10, offsetX=0, offsetZ=0, offsetY=0) {
    const geometry = new THREE.BufferGeometry();
    const numPoints = width * length;

    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);

    let k = 0;
    let y_min = Infinity;
    let y_max = -Infinity;

    // Build Positions
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < length; j++) {
            const u = i / width *(end - start) + start;
            const v = j / length *(end - start) + start;
            
            const x = u;
            const y = f(u+offsetX,v+offsetZ)+offsetY;
            const z = v;

            positions[3 * k] = x;
            positions[3 * k + 1] = y;
            positions[3 * k + 2] = z;

            if(y < y_min){
                y_min = y;
            }

            if(y > y_max){ 
                y_max = y;
            }
            k++
        }
    }
   
    // Build Colors
    for (let i=0; i<positions.length; i+=3){
        const intensity = (positions[i+1] - y_min) / (y_max - y_min);
        const color = getGradientColor(intensity);
        colors[i] = color.r;
        colors[i+1] = color.g;
        colors[i+2] = color.b;
    }

    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();

    return geometry;
}

function generatePointcloud( width, length, f) {
    const geometry = generatePointCloudGeometry(width, length, f);
    const material = new THREE.PointsMaterial({ size: pointSize, vertexColors: true });

    return new THREE.Points(geometry, material);
}

function init() {
    const container = document.getElementById('container');

    scene = new THREE.Scene();
    
    // Camera

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(10, 10, 10);
    camera.lookAt(scene.position);
    camera.updateMatrix();

    // Pointclouds
    const pcBuffer = generatePointcloud(width, length, g);
    pcBuffer.scale.set(1, 1, 1);
    pcBuffer.position.set(0, 0, 0);
    scene.add(pcBuffer);

    pointclouds = pcBuffer;

    // Axes and labels
    const axesLabels = ['X', 'Y', 'Z'];
    const axesPositions = [new THREE.Vector3(5, 0.1, 0), new THREE.Vector3(0.1, 5, 0), new THREE.Vector3(0, 0.1, 5)];

    const fontLoader = new FontLoader();
    fontLoader.load('./font/helvetiker_regular.typeface.json', function (font) {
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 0; i < 3; i++) {
            const textGeometry = new TextGeometry(axesLabels[i], { font: font, size: 0.2, height: 0.1 });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.copy(axesPositions[i]);
            scene.add(textMesh);
        }
    });
    const axesHelper = new THREE.AxesHelper( 5 );
    scene.add( axesHelper );


    // Spheres
    const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
       
    sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = threshold;

    // Controls
    controls = new OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 0.5, 0 );
    controls.update();
    controls.enablePan = false;
    controls.enableDamping = true;


    
    window.addEventListener('resize', onWindowResize);
    document.addEventListener("pointermove", onPointerMove);
    container.addEventListener("click", onClick);
}

function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onClick(event) {
    // Check if sphere is on scene
    if(set_point == true){
        onPointerMove(event);
        move_sphere();
        if (sphere.scale.x > 0) {
            set_point = false;
            build_gradient_path();
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Add point to raycast
    if(set_point)
        move_sphere();
    renderer.render(scene, camera);
}

function move_sphere(){
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects( [pointclouds], false );
    intersection = ( intersections.length ) > 0 ? intersections[ 0 ] : null;
    if(intersection !== null){
        sphere.position.set(intersection.point.x, intersection.point.y, intersection.point.z);
        sphere.scale.set(1,1,1)
    }else{
        sphere.position.set(0,0,0);
        sphere.scale.set(0,0,0)
    }
}

// Gradient Descent
const precision = 0.001

function gradientDescent(x, y, f, learning_rate=0.01){
    const dx = (f(x+precision, y) - f(x, y)) / precision;
    const dy = (f(x, y+precision) - f(x, y)) / precision;

    // x_n+1 = x_n - learning_rate * df/dx
    x = x - learning_rate * dx;
    y = y - learning_rate * dy;

    return [x, y];
}

const iterations = 500;
function build_gradient_path(){

    let [x, z] = [sphere.position.x, sphere.position.z];
    const sphereGeometry = new THREE.SphereGeometry(0.05, 32, 32);
    for(let i =0; i< iterations; i++){ // getGradientColor(i/iterations, green, blue)
        const sphereMaterial = new THREE.MeshBasicMaterial({ color:  getGradientColor(i/iterations, green, blue)});
        const sphere_tmp = new THREE.Mesh(sphereGeometry, sphereMaterial);
        
        [x, z] = gradientDescent(x, z, functions[current_index][0]);
        sphere_tmp.position.set(x, functions[current_index][0](x, z) + functions[current_index][5], z);
        scene.add(sphere_tmp);
        path.push(sphere_tmp);
    }
}

function dispose_path(){
    for(let i = 0; i < path.length; i++){
        path[i].geometry.dispose();
        path[i].material.dispose();
        scene.remove(path[i]);
    }
    sphere.scale.set(0,0,0)
}

// Functions
// f start end offsetX offsetZ
const functions = [[f, -3,3,0,0,-5], [g,-10, 10, 0, 0, 0], [h,-6,6,0,0, -3], [i, -3, 3,0,0, -5], [j, -7, 5,0,0,0]];

function f(x,y){
    return x**2 + y**2;
}

function g(x,y){
    return -Math.cos(x)*Math.cos(y)*Math.exp(-((x-Math.PI)**2 + (y-Math.PI)**2));
}

function h(x,y){
    return 0.26 * (x**2 + y**2) - 0.48 * x * y
}

function i(x,y){
    return -20.0 * Math.exp(-0.2*Math.sqrt(0.5*(x**2 + y**2))) - Math.exp(0.5*(Math.cos(2*Math.PI*x) + Math.cos(2*Math.PI*y))) + Math.E + 20;
}

function j(x,y){
    return Math.abs(Math.sin(x) * Math.cos(y) * Math.exp(Math.abs(1 - Math.sqrt(x**2 + y**2) / Math.PI)));
}