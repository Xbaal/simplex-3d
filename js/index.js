var camera, controls, scene, renderer, domEvents, stats, light;

var polyhedron;
var MODELS = {};

init();
animate();

function init() {

  //STATS
  stats = new Stats();
  document.getElementById("ThreeJS").appendChild(stats.dom);
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
  if ( Detector.webgl ) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } else {
    //TODO: make the CanvasRenderer work properly or remove it
    renderer = new THREE.CanvasRenderer();
  }
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  var container = document.getElementById("ThreeJS");
  container.appendChild(renderer.domElement);
  // EVENTS
  domEvents = new THREEx.DomEvents(camera, renderer.domElement);
  // CONTROLS
  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.noPan = true;
  // LIGHT
  light = new THREE.AmbientLight(0x222222, 7);
  scene.add( light );
  // SKYBOX
  var skyBoxGeometry = new THREE.CubeGeometry(8000, 8000, 8000);
  var skyBoxMaterial = new THREE.MeshBasicMaterial({ color: 0xccccff, side: THREE.BackSide });
  var skyBox = new THREE.Mesh(skyBoxGeometry, skyBoxMaterial);
  scene.add(skyBox);

  window.addEventListener("resize", onWindowResize, false);

}

function displayPolyhedron() {
  var selectedModel = $("#model").val();
  if (MODELS[selectedModel]) {
    if (polyhedron) scene.remove(polyhedron);
    polyhedron = new Polyhedron(MODELS[selectedModel]);
    scene.add(polyhedron);
  }
}

function Vertex(vector, id) {
  THREE.Mesh.call(this, this.geometry, this.standardMaterial);
  this.status = {
    hover: false,
    active: false
  };
  this.vertexId = id;
  this.position.add(vector);
  var v = this;
  domEvents.addEventListener(v, "click", function() {
    v.setStatus( "active", !v.status.active );
  }, false);
  domEvents.addEventListener(v, "mouseover", function() {
    v.setStatus( "hover", true );
  }, false);
  domEvents.addEventListener(v, "mouseout", function() {
    v.setStatus( "hover", false );
  });
}
Vertex.prototype = Object.create(THREE.Mesh.prototype);
Vertex.prototype.constructor = Vertex;
Object.assign(Vertex.prototype, {
  geometry: new THREE.SphereGeometry( 6, 12, 6 ),
  standardMaterial: new THREE.MeshLambertMaterial({ color: 0x222244 }),
  hoverMaterial: new THREE.MeshLambertMaterial({ color: 0x444488 }),
  activeMaterial: new THREE.MeshLambertMaterial({ color: 0xff0000 }),
  setStatus: function (attribute, status) {
    this.status[attribute] = Boolean(status);
    this.updateMaterial();
  },
  getStatus: function () {
    var ret = {};
    $.each( this.status, function(attribute, value){
      if (attribute === "hover") return; //should not be copied
      ret[attribute] = value;
    });
    return ret;
  },
  updateMaterial: function() {
    if (this.status.active) {
      this.material = this.activeMaterial;
    } else if (this.status.hover) {
      this.material = this.hoverMaterial;
    } else {
      this.material = this.standardMaterial;
    }
  }
});

function Edge(vertex1, vertex2) {
  var direction = new THREE.Vector3().subVectors(vertex2.position, vertex1.position);
  var arrow = new THREE.ArrowHelper(direction.clone().normalize(), vertex1.position);
  var edgeGeometry = new THREE.CylinderGeometry( 2, 2, direction.length(), 8, 4 );
  this.status = {
    hover: false,
    improving: false
  };
  THREE.Mesh.call(this,edgeGeometry,this.standardMaterial);
  var edge = this;
  edge.position.addVectors(vertex1.position, direction.multiplyScalar(0.5));
  edge.rotation.setFromQuaternion(arrow.quaternion);

  domEvents.addEventListener(edge, "click", function() {
    edge.setStatus( "improving", !edge.status.improving );
  }, false);
  domEvents.addEventListener(edge, "mouseover", function() {
    edge.setStatus( "hover", true );
  }, false);
  domEvents.addEventListener(edge, "mouseout", function() {
    edge.setStatus( "hover", false );
  });
}
Edge.prototype = Object.create(THREE.Mesh.prototype);
Edge.prototype.constructor = Edge;
Object.assign(Edge.prototype, {
  standardMaterial: new THREE.MeshLambertMaterial({ color: 0x666666 }),
  hoverMaterial: new THREE.MeshLambertMaterial({ color: 0xcccccc }),
  improvingMaterial: new THREE.MeshLambertMaterial({ color: 0x00aa00 }),
  setStatus: function (attribute, status) {
    this.status[attribute] = Boolean(status);
    this.updateMaterial();
  },
  getStatus: function () {
    var ret = {};
    $.each( this.status, function(attribute, value){
      if (attribute === "hover") return; //should not be copied
      ret[attribute] = value;
    });
    return ret;
  },
  updateMaterial: function () {
    if (this.status.improving) {
      this.material = this.improvingMaterial;
    } else if (this.status.hover) {
      this.material = this.hoverMaterial;
    } else {
      this.material = this.standardMaterial;
    }
  }
});

function Face(vertices, normal) {
  //this class assumes, that the vertices are coplanar
  this.vertices = vertices;
  this.status = {
    active: false
  };
  var geometry = new THREE.Geometry();
  geometry.vertices = vertices.map(function(v) {
    return v.position;
  });
  if (!normal && vertices.length < 3) {
    throw new Error("Faces with less than 3 vertices must have a normal defined!");
  }
  if (normal instanceof Array) {
    normal = new THREE.Vector3(normal[0], normal[1], normal[2]);
  }
  if (vertices.length === 1) {
    this.faceType = "plane";
    geometry = new THREE.PlaneGeometry( 100, 100 );
    THREE.Mesh.call( this, geometry, this.planeMaterial );
    this.position.add( vertices[0].position );
    this.lookAt(normal);
  }
  if (vertices.length === 2) {
    this.faceType = "plane";
    var edgeLength = vertices[0].position.distanceTo( vertices[1].position );
    console.log(edgeLength);
    geometry = new THREE.PlaneGeometry( 100 + edgeLength + 100, 100 );
    THREE.Mesh.call(this, geometry, this.planeMaterial);
    this.position.addVectors( vertices[0].position, vertices[1].position ).multiplyScalar( .5 );
    this.lookAt(normal);
  }
  if (vertices.length >= 3) {
    this.faceType = "face";
    var subFace;
    for (var i = 0; i < vertices.length - 2; i++) {
      subFace = new THREE.Face3( 0, i + 1, i + 2 );
      subFace.color = new THREE.Color( 0xffffff );
      geometry.faces.push(subFace);
    }
    geometry.computeFaceNormals();
    THREE.Mesh.call( this, geometry, this.faceMaterial );
  }
  this.a = normal || subFace.normal;
  this.b = this.a.dot( vertices[0].position );
  console.log(this.a.x + "*x + " + this.a.y + "*y + " + this.a.z + "*z <= " + this.b);
  var f = this;
  domEvents.addEventListener(f, "click", function() {
    f.setStatus( "active", !f.status.active );
  }, false);
}
Face.prototype = Object.create(THREE.Mesh.prototype);
Face.prototype.constructor = Face;
Object.assign(Face.prototype, {
  faceMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, transparent: true, opacity: 0.5 }),
  activefaceMaterial: new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.FrontSide, transparent: true, opacity: 0.5 }),
  //backFaceMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.5 }),
  planeMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
  activePlaneMaterial: new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
  setStatus: function (attribute, status) {
    this.status[attribute] = Boolean(status);
    this.updateMaterial();
  },
  getStatus: function () {
    var ret = {};
    $.each( this.status, function(attribute, value){
      if (attribute === "hover") return; //should not be copied
      ret[attribute] = value;
    });
    return ret;
  },
  updateMaterial: function () {
    if (this.status.active) {
      if (this.faceType === "face") {
        this.material = this.activefaceMaterial;
      } else {
        this.material = this.activePlaneMaterial;
      }
    } else {
      if (this.faceType === "face") {
        this.material = this.faceMaterial;
      } else {
        this.material = this.planeMaterial;
      }
    }
  }
});

/*
//Arrows
var dir = new THREE.Vector3( 1, 2, 0 );
var origin = new THREE.Vector3( 100, 0, 0 );
var length = 100;

var arrowHelper = new THREE.ArrowHelper( dir.normalize(), origin, length, 0x222200 );
scene.add( arrowHelper );
*/

function Polyhedron(data) {
  THREE.Object3D.call(this);
  if (typeof data.normal !== "object") {
    data.normal = {};
  }
  var i;
  // convert vertex data to THREE.js vectors

  //TODO: consider removing multiplyScalar(100)
  var vertices = [];
  for (i = 0; i < data.vertex.length; i++) {
    var vector = new THREE.Vector3(data.vertex[i][0], data.vertex[i][1], data.vertex[i][2]).multiplyScalar(100);
    var vertex = new Vertex(vector, i);
    vertices.push(vertex);
    this.add(vertex);
  }
  this.vertices = vertices;

  var edges = [];
  for (i = 0; i < data.edge.length; i++) {
    var index0 = data.edge[i][0];
    var index1 = data.edge[i][1];
    var edge = new Edge(vertices[index0], vertices[index1]);
    edges.push(edge);
    this.add(edge);
  }
  this.edges = edges;

  var faces = [];
  for (i = 0; i < data.face.length; i++) {
    var v = data.face[i].map(function(index){
      return vertices[index];
    });
    var face = new Face(v, data.normal[i]);
    faces.push(face);
    this.add(face);
  }
  this.faces = faces;
}
Polyhedron.prototype = Object.create(THREE.Object3D.prototype);
Polyhedron.prototype.constructor = Polyhedron;
Object.assign(Polyhedron.prototype, {
  sharedVertices: function(faces) {
    var count = {};
    faces.forEach(function(face){
      face.vertices.forEach(function(vertex){
        count[vertex.vertexId] = (count[vertex.vertexId] || 0) + 1;
      });
    });
    return Object.keys(count).filter(function(vertexId){
      return count[vertexId] === faces.length;
    });
  },
  adjacentFaces: function(vertex) {
    return this.faces.filter(function(face){
      return face.vertices.some(function(v){
        return v === vertex;
      });
    });
  },
  setStatus: function(status) {
    var polyhedron = this;
    ["vertices", "edges", "faces"].forEach(function(meshType){
      if (!status[meshType]) return;
      $.each( status[meshType], function(index, statusObject) {
        var mesh = polyhedron[meshType][index];
        if (mesh) {
          $.each( statusObject, function(attribute, value) {
            mesh.setStatus( attribute, Boolean(value) );
          });
        }
      });
    });
  },
  getStatus: function() {
    var polyhedron = this;
    var ret = {};
    ["vertices", "edges", "faces"].forEach(function(meshType){
      ret[meshType] = polyhedron[meshType].map(function(mesh){
        return mesh.getStatus();
      });
    });
    return ret;
  }
});


function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

  //restrict zoom-range
  if (camera.position.length() < 150) {
    camera.position.setLength(150);
  } else if (camera.position.length() > 500) {
    camera.position.setLength(500);
  }

  requestAnimationFrame( animate );

  controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true

  stats.update();

  render();

}

function render() {

  renderer.render(scene, camera);

}

function loadMODELS(path) {
  $.getJSON(path, function (data){
    MODELS = data;
    $("#model").empty();
    Object.keys(MODELS).forEach(function(polyhedron){
      $("#model").append("<option value='" + polyhedron + "'>" + polyhedron + "</option>");
    });
    displayPolyhedron();
  });
}

loadMODELS("js/models.json");
