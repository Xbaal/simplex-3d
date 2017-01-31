var camera, controls, scene, renderer, domEvents, stats;

init();
animate();

function init() {

  //STATS
  stats = new Stats();
  document.getElementById( "ThreeJS" ).appendChild(stats.dom);
  // SCENE
  scene = new THREE.Scene();
  // CAMERA
  var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
  var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
  camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
  scene.add(camera);
  camera.position.set(0,150,400);
  camera.lookAt(scene.position);
  // RENDERER
  if ( Detector.webgl )
    renderer = new THREE.WebGLRenderer({ antialias: true });
  else //TODO: make the CanvasRenderer work properly or remove it
    renderer = new THREE.CanvasRenderer();
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  var container = document.getElementById( "ThreeJS" );
  container.appendChild( renderer.domElement );
  // EVENTS
  domEvents = new THREEx.DomEvents(camera, renderer.domElement);
  //THREEx.WindowResize(renderer, camera);
  // CONTROLS
  controls = new THREE.TrackballControls( camera, renderer.domElement );
  controls.noPan = true;
  // LIGHT
  scene.add( new THREE.AmbientLight( 0x222222 , 7) );
  // SKYBOX
  var skyBoxGeometry = new THREE.CubeGeometry( 8000, 8000, 8000 );
  var skyBoxMaterial = new THREE.MeshBasicMaterial( { color: 0xccccff, side: THREE.BackSide } );
  var skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );
  scene.add(skyBox);

  window.addEventListener( "resize", onWindowResize, false );

}

function displayPolyhedron(data) {
  var polyhedronMesh = polyhedronDataToMesh(data);
  scene.add(polyhedronMesh);
}

var frontFaceMaterial = new THREE.MeshBasicMaterial(
  { color: 0xffffff, side: THREE.FrontSide, transparent: true, opacity: 0.5 }
);
var backFaceMaterial = new THREE.MeshBasicMaterial(
  { color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.5 }
);

function Vertex(vector, id) {
  THREE.Mesh.call(this, this.geometry, this.standardMaterial);
  var v = this;
  v.vertexId = id;
  v.position.add(vector);
  domEvents.addEventListener(v, "click", function() {
    console.log(v.vertexId);
    v.scale.multiplyScalar(2);
    setTimeout(function() {
      v.scale.multiplyScalar(0.5);
    },2000);
  }, false);
  //mousemove is here not really useful like this...
  domEvents.addEventListener(v, "mouseover", function() {
    v.material = v.hoverMaterial;
  }, false);
  domEvents.addEventListener(v, "mouseout", function() {
    v.material = v.standardMaterial;
  });
  domEvents.addEventListener(v, "contextmenu", function() {
    if (v.material === v.standardMaterial) {
      v.material = v.hoverMaterial;
    } else {
      v.material = v.standardMaterial;
    }
  }, false);
}
Vertex.prototype = Object.create(THREE.Mesh.prototype);
Vertex.prototype.constructor = Vertex;
Object.assign(Vertex.prototype, {
  geometry: new THREE.SphereGeometry( 6, 12, 6 ),
  standardMaterial: new THREE.MeshLambertMaterial({ color: 0x222244 }),
  hoverMaterial: new THREE.MeshLambertMaterial({ color: 0x662222 })
});

function Edge(vertex1, vertex2) {
  var direction = new THREE.Vector3().subVectors(vertex2.position, vertex1.position);
  var arrow = new THREE.ArrowHelper(direction.clone().normalize(), vertex1.position);
  var edgeGeometry = new THREE.CylinderGeometry( 2, 2, direction.length(), 8, 4 );
  THREE.Mesh.call(this,edgeGeometry,this.standardMaterial);
  var edge = this;
  edge.position.addVectors(vertex1.position, direction.multiplyScalar(0.5));
  edge.rotation.setFromQuaternion(arrow.quaternion);
  // the result should align with:
  //   scene.add( new THREE.ArrowHelper( direction.clone().normalize(), vertex1.position, direction.length()) );
  domEvents.addEventListener(edge, "mouseover", function() {
    edge.material = edge.hoverMaterial;
  }, false);
  domEvents.addEventListener(edge, "mouseout", function() {
    edge.material = edge.standardMaterial;
  });
}
Edge.prototype = Object.create(THREE.Mesh.prototype);
Edge.prototype.constructor = Edge;
Object.assign(Edge.prototype, {
  standardMaterial: new THREE.MeshLambertMaterial({ color: 0x666666 }),
  hoverMaterial: new THREE.MeshLambertMaterial({ color: 0xcccccc })
});

function Face(vertices) {
  var geometry = new THREE.Geometry();
  geometry.vertices = vertices.map(function(v) {
    return v.position;
  });
  for (var i = 0; i < vertices.length - 2; i++) {
    var f = new THREE.Face3( 0, i + 1, i + 2 );
    f.color = 0xffffff;
    geometry.faces.add(f);
  }
  THREE.Mesh.call(this, geometry, this.frontFaceMaterial);
}
Face.prototype = Object.create(THREE.Mesh.prototype);
Face.prototype.constructor = Face;
Object.assign(Face.prototype, {
  frontFaceMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, transparent: true, opacity: 0.5 }),
  backFaceMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.5 })
});


function polyhedronDataToMesh(data) {
  var i;
  var polyhedron = new THREE.Object3D();
  // convert vertex data to THREE.js vectors

  //TODO: consider removing multiplyScalar(100)
  var vertices = [];
  for (i = 0; i < data.vertex.length; i++) {
    var vector = new THREE.Vector3( data.vertex[i][0], data.vertex[i][1], data.vertex[i][2] ).multiplyScalar(100);
    var vertex = new Vertex(vector, i);
    vertices.push( vertex );
    polyhedron.add( vertex );
  }

  var edges = [];
  for (i = 0; i < data.edge.length; i++) {
    var index0 = data.edge[i][0];
    var index1 = data.edge[i][1];
    var edge = new Edge(vertices[index0], vertices[index1]);
    edges.push( edge );
    polyhedron.add( edge );
  }

  // convert face data to a single (triangulated) geometry

  var geometry = new THREE.Geometry();
  geometry.vertices = vertices.map(function(v) {
    return v.position;
  });
  var faceIndex = 0;
  for (var faceNum = 0; faceNum < data.face.length; faceNum++) {
    for (i = 0; i < data.face[faceNum].length - 2; i++) {
      geometry.faces[faceIndex] = new THREE.Face3(
        data.face[faceNum][0],
        data.face[faceNum][i + 1],
        data.face[faceNum][i + 2]
      );
      geometry.faces[faceIndex].color = 0xffffff;
      faceIndex++;
    }
  }

  //TODO: think about necessity (?)
  //geometry.computeFaceNormals();
  //geometry.computeVertexNormals();

  //backSides have to be added first (or render order has to be tweaked)
  polyhedron.add(new THREE.Mesh(geometry, backFaceMaterial));
  polyhedron.add(new THREE.Mesh(geometry, frontFaceMaterial));

  return polyhedron;
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

  //restrict zoom-range
  if (camera.position.length() < 150)
    camera.position.setLength(150);
  if (camera.position.length() > 500)
    camera.position.setLength(500);

  requestAnimationFrame( animate );

  controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true

  stats.update();

  render();

}

function render() {

  renderer.render( scene, camera );

}

function loadJSON() {
  displayPolyhedron(MODELS.Cube);
}

loadJSON();
