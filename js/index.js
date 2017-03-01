var camera, controls, scene, renderer, domEvents, stats, light, skyBox;
var arrows = [];
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
  skyBox = new THREE.Mesh(skyBoxGeometry, skyBoxMaterial);
  scene.add(skyBox);

  window.addEventListener("resize", onWindowResize, false);

}

function displayPolyhedron() {
  var selectedModel = $("#model").val();
  if (MODELS[selectedModel]) {
    if (polyhedron) {
      scene.remove( polyhedron );
      scene.remove( polyhedron.directionArrow );
      arrows.forEach(function(arrow) {
        scene.remove( arrow );
      });
      arrows = [];
    }
    polyhedron = new Polyhedron(MODELS[selectedModel]);
    scene.add(polyhedron);
  }
}

var PolyhedronMesh = {
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
  resetStatus: function () {
    $.each( this.status, function(attribute){
      this.status[attribute] = false;
    }.bind(this) );
    this.updateMaterial();
  }
};

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
    polyhedron.resetStatus();
    console.log("clicked on: vertexId",v.vertexId);
    polyhedron.basis = polyhedron.getBasisForVertex( v ).setActive();
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
Object.assign(Vertex.prototype, PolyhedronMesh);
Object.assign(Vertex.prototype, {
  geometry: new THREE.SphereGeometry( 6, 12, 6 ),
  standardMaterial: new THREE.MeshLambertMaterial({ color: 0x222244 }),
  hoverMaterial: new THREE.MeshLambertMaterial({ color: 0x444488 }),
  activeMaterial: new THREE.MeshLambertMaterial({ color: 0xff0000 }),
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
  this.vertices = [vertex1, vertex2];
  var direction = new THREE.Vector3().subVectors(vertex2.position, vertex1.position);
  var arrow = new THREE.ArrowHelper(direction.clone().normalize(), vertex1.position);
  var edgeGeometry = new THREE.CylinderGeometry( 2, 2, direction.length(), 8, 4 );
  this.status = {
    hover: false,
    improving: false
  };
  THREE.Mesh.call(this,edgeGeometry,this.standardMaterial);
  this.position.addVectors(vertex1.position, direction.multiplyScalar(0.5));
  this.rotation.setFromQuaternion(arrow.quaternion);

  var edge = this;
  //domEvents.addEventListener(edge, "click", function() {
  //  edge.setStatus( "improving", !edge.status.improving );
  //}, false);
  domEvents.addEventListener(edge, "mouseover", function() {
    edge.setStatus( "hover", true );
  }, false);
  domEvents.addEventListener(edge, "mouseout", function() {
    edge.setStatus( "hover", false );
  });
}
Edge.prototype = Object.create(THREE.Mesh.prototype);
Edge.prototype.constructor = Edge;
Object.assign(Edge.prototype, PolyhedronMesh);
Object.assign(Edge.prototype, {
  standardMaterial: new THREE.MeshLambertMaterial({ color: 0x666666 }),
  hoverMaterial: new THREE.MeshLambertMaterial({ color: 0xcccccc }),
  improvingMaterial: new THREE.MeshLambertMaterial({ color: 0x00aa00 }),
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
  }
  if (vertices.length === 2) {
    this.faceType = "plane";
    var edgeLength = vertices[0].position.distanceTo( vertices[1].position );
    console.log(edgeLength);
    geometry = new THREE.PlaneGeometry( 100 + edgeLength + 100, 100 );
    THREE.Mesh.call(this, geometry, this.planeMaterial);
    this.position.addVectors( vertices[0].position, vertices[1].position ).multiplyScalar( .5 );
    this.up = this.position.clone().normalize();
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
  if (normal) {
    var arrow = new THREE.ArrowHelper( normal.clone().normalize(), this.position, 50, 0x222200 );
    scene.add( arrow );
    arrows.push( arrow );

    var m1 = new THREE.Matrix4().lookAt( this.position.clone().add(normal), this.position, this.up );
    this.quaternion.setFromRotationMatrix( m1 );
  }
  this.a = normal || subFace.normal;
  this.a.normalize();
  this.b = this.a.dot( vertices[0].position );
  console.log("face inequaltiy:",this.a.x + "*x + " + this.a.y + "*y + " + this.a.z + "*z <= " + this.b);
  //var f = this;
  //domEvents.addEventListener(f, "click", function() {
  //  f.setStatus( "active", !f.status.active );
  //}, false);
}
Face.prototype = Object.create(THREE.Mesh.prototype);
Face.prototype.constructor = Face;
Object.assign(Face.prototype, PolyhedronMesh);
Object.assign(Face.prototype, {
  faceMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, transparent: true, opacity: 0.3 }),
  activefaceMaterial: new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.FrontSide, transparent: true, opacity: 0.5 }),
  //backFaceMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.5 }),
  planeMaterial: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3 }),
  activePlaneMaterial: new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
  badPlaneMaterial: new THREE.MeshBasicMaterial({ color: 0x660000, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),

  updateMaterial: function () {
    if (this.status.bad) {
      this.material = this.badPlaneMaterial;
    } else if (this.status.active) {
      //if (this.faceType === "face") {
      //  this.material = this.activefaceMaterial;
      //} else {
      this.material = this.activePlaneMaterial;
      //}
    } else {
      //if (this.faceType === "face") {
      //  this.material = this.faceMaterial;
      //} else {
      this.material = this.planeMaterial;
      //}
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

  this.basis = null;
  this.direction = new THREE.Vector3(1,2,3);
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
    }).map(function(vertexId){
      return this.vertices[vertexId];
    }.bind(this));
  },
  adjacentFaces: function(vertex) {
    return this.faces.filter(function(face){
      return face.vertices.some(function(v){
        return v === vertex;
      });
    });
  },
  getBasisForVertex: function(vertex) {
    var adjacent = this.adjacentFaces(vertex);
    for (var i = 0; i < adjacent.length; i++) {
      for (var j = i + 1; j < adjacent.length; j++) {
        for (var k = j + 1; k < adjacent.length; k++) {
          var b = new Basis( [adjacent[i], adjacent[j], adjacent[k]] );
          if (b.vertex && b.inverseMatrix) return b;
        }
      }
    }
    console.error("[getBasisForVertex] could not find a Basis at vertex", vertex.vertexId);
    return null;
  },
  getEdgeFromVertices: function(v) {
    for (var i = 0; i < this.edges.length; i++) {
      var w = this.edges[i].vertices;
      if ( (v[0] === w[0] && v[1] === w[1]) || (v[0] === w[1] && v[1] === w[0]) ) {
        return this.edges[i];
      }
    }
    return null;
  },
  getEdgeInDirection: function(v, direction) {
    var best = [0.99 * Math.PI / 2, null];
    for (var i = 0; i < this.edges.length; i++) {
      var e = this.edges[i];
      var eDirection;
      if (e.vertices[0] === v) {
        eDirection = e.vertices[1].position.clone().sub( e.vertices[0].position );
      } else if (e.vertices[1] === v) {
        eDirection = e.vertices[0].position.clone().sub( e.vertices[1].position );
      } else {
        continue;
      }
      var angle = direction.angleTo( eDirection );
      if (angle > best[0]) {
        best = [angle,e];
      }
    }
    return best[1];
  },
  getImprovingBasisChanges: function() {
    if (!this.basis || !this.basis.inverseMatrix) {
      this.basis = this.getBasisForVertex(this.vertices[Math.floor(Math.random() * this.vertices.length)]);
    }
    if (!this.basis.vertex) {
      console.error("[getImprovingEdges] invalid basis (no vertex identified)");
      return [];
    }
    var basis = this.basis;
    var v = basis.vertex.position;
    //var improvingEdges = [];
    var improvingBasisChanges = [];
    var bestEdges = [Math.PI / 2, []];
    for (var index = 0; index < basis.edgeDirections.length; index++) {
      var s = basis.edgeDirections[index];
      //console.log("edgeDirection",s);
      var sc = s.dot( this.direction );
      if (sc > 0) {
        //var a = new THREE.ArrowHelper( s.clone().normalize(), v, 200, 0x0055aa );
        //scene.add( a );
        basis.faces[index].setStatus( "bad", true );
        var angle = s.angleTo( this.direction );
        console.log(angle / Math.PI);
        if (angle <= bestEdges[0]) {
          if (angle < bestEdges[0]) {
            bestEdges = [angle, []];
          }
          bestEdges[1].push( [index, s] );
        }
      }
    }
    bestEdges[1].forEach(function(a) {
      var index = a[0];
      var s = a[1];
      var bestLambda = [Infinity,[]];
      this.faces.forEach(function(face) {
        if (face.a.dot(s) <= 0) return;
        for (var i = 0; i < basis.faces.length; i++) {
          if (basis.faces[i] === face) return;
        }
        var lambda = ( face.b - face.a.dot(v) ) / face.a.dot(s);
        if (lambda <= bestLambda[0]) {
          if (lambda < bestLambda[0]) {
            bestLambda = [lambda,[]];
          }
          bestLambda[1].push(face);
        }
      });
      if (bestLambda[0] === Infinity) {
        console.warn("[improvingEdges] The polyhedron is unbounded");
        return;
      }
      bestLambda[1].forEach(function(face) {
        improvingBasisChanges.push( [index,face] );
      });
    }.bind(this));

    return improvingBasisChanges;
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
  },
  resetStatus: function() {
    var polyhedron = this;
    ["vertices", "edges", "faces"].forEach(function(meshType){
      polyhedron[meshType].forEach(function (mesh) {
        mesh.resetStatus();
      });
    });
  },
  makeStep: function() {
    var changes = polyhedron.getImprovingBasisChanges();
    if (changes.length === 0) {
      console.warn("can't find a better solution!!");
      return;
    }
    //random step
    if (changes.length > 1) {
      console.log("choosing randomly out of " + changes.length + " basis changes");
    }
    var change = changes[Math.floor( Math.random() * changes.length )];
    console.log("basis change:",change);
    polyhedron.basis.changeBasis( change[0], change[1] ).setActive();
  }
});

function Basis (basisFaces) {
  //basis vectors are row-vectors in this.matrix
  this.faces = basisFaces;
  this.vertices = polyhedron.sharedVertices(basisFaces);
  if (this.vertices.length === 1) {
    this.vertex = this.vertices[0];
  }
  var elements = [];
  basisFaces[0].a.toArray( elements, 0 );
  basisFaces[1].a.toArray( elements, 3 );
  basisFaces[2].a.toArray( elements, 6 );
  this.matrix = new THREE.Matrix3().fromArray( elements ).transpose();

  this.inverseMatrix = null;
  this.edgeDirections = [];
  try {
    this.inverseMatrix = new THREE.Matrix3().getInverse( this.matrix, true );
    var mA = this.inverseMatrix.toArray();
    //negation to point in edge direction
    this.edgeDirections[0] = new THREE.Vector3().fromArray( mA, 0 ).negate().normalize();
    this.edgeDirections[1] = new THREE.Vector3().fromArray( mA, 3 ).negate().normalize();
    this.edgeDirections[2] = new THREE.Vector3().fromArray( mA, 6 ).negate().normalize();
  } catch (e) {
    console.error("invalid basis");
  }

  this.setActive = function() {
    polyhedron.vertices.forEach(function(vertex) {
      vertex.setStatus( "active", false );
    });
    this.vertices.forEach(function(vertex) {
      vertex.setStatus( "active", true );
    });
    polyhedron.faces.forEach(function(face) {
      face.setStatus( "active", false );
    });
    for (var i = 0; i < basisFaces.length; i++) {
      basisFaces[i].setStatus( "active", true );
    }
    if (this.vertex) {
      if (polyhedron.directionArrow) {
        polyhedron.directionArrow.position.copy( this.vertex.position );
      } else {
        var d = polyhedron.direction.clone().normalize();
        polyhedron.directionArrow = new THREE.ArrowHelper( d, this.vertex.position, 100, 0xffa500 );
        scene.add( polyhedron.directionArrow );
      }
    }
    return this;
  };

  this.changeBasis = function (indexOut, newFace) {
    console.log("changing basis, current faces:",this.faces);
    polyhedron.vertex && polyhedron.vertex.setStatus( "active", false );
    this.faces[indexOut].setStatus( "active", false );
    for (var i = 0; i < this.faces.length; i++) {
      this.faces[i].setStatus( "bad", false );
    }
    this.faces.splice( indexOut, 1, newFace );
    Basis.call(this, this.faces);
    return this;
  };
}

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
