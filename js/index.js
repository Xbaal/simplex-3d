var camera, cameraTween;
var controls, scene, renderer, domEvents, stats, light, skyBox;
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
  camera.minDistance = 1;
  camera.maxDistance = 5;
  camera.position.set(0,0,3);
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
    if (polyhedron) scene.remove( polyhedron );
    polyhedron = new Polyhedron( MODELS[selectedModel] );
    polyhedron.position.copy( polyhedron.mid ).multiplyScalar( -1 );
    camera.minDistance = polyhedron.radius * 2;
    camera.maxDistance = polyhedron.radius * 5;
    moveCamera( new THREE.Vector3(0,0,1), polyhedron.radius * 3 );
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

function Vertex(vector, id, scale) {
  THREE.Mesh.call(this, this.geometry, this.standardMaterial);
  this.status = {
    hover: false,
    active: false
  };
  this.vertexId = id;
  this.position.copy( vector );
  this.scale.multiplyScalar(scale);
  domEvents.addEventListener(this, "click", function() {
    polyhedron.resetStatus();
    console.log("clicked on: vertexId",this.vertexId);
    polyhedron.basis = polyhedron.getBasisForVertex( polyhedron.vertices[this.vertexId] ).setActive();
  }.bind(this), false);
  domEvents.addEventListener(this, "mouseover", function() {
    this.setStatus( "hover", true );
  }.bind(this), false);
  domEvents.addEventListener(this, "mouseout", function() {
    this.setStatus( "hover", false );
  }.bind(this), false);
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

function Edge(vertex1, vertex2, scale) {
  this.vertices = [vertex1, vertex2];
  var direction = new THREE.Vector3().subVectors(vertex2.position, vertex1.position);
  var arrow = new THREE.ArrowHelper(direction.clone().normalize(), vertex1.position);
  var edgeGeometry = new THREE.CylinderGeometry( 2, 2, direction.length(), 8, 4 );
  this.status = {
    hover: false,
    improving: false
  };
  THREE.Mesh.call( this, edgeGeometry, this.standardMaterial );
  this.position.addVectors( vertex1.position, direction.multiplyScalar(0.5) );
  this.rotation.setFromQuaternion( arrow.quaternion );

  this.scale.setX( scale );
  this.scale.setZ( scale );
  //domEvents.addEventListener(this, "click", function() {
  //  edge.setStatus( "improving", !edge.status.improving );
  //}.bind(this), false);
  domEvents.addEventListener(this, "mouseover", function() {
    this.setStatus( "hover", true );
  }.bind(this), false);
  domEvents.addEventListener(this, "mouseout", function() {
    this.setStatus( "hover", false );
  }.bind(this), false);
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

function Face(vertices, normal, scale) {
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
    geometry = new THREE.PlaneGeometry( 100 * scale, 100 * scale );
    THREE.Mesh.call( this, geometry, this.planeMaterial );
    this.position.add( vertices[0].position );
  }
  if (vertices.length === 2) {
    this.faceType = "plane";
    var edgeLength = vertices[0].position.distanceTo( vertices[1].position );
    console.log(edgeLength);
    geometry = new THREE.PlaneGeometry( edgeLength + 200 * scale, 100 * scale );
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
  if (this.faceType === "plane") {
    var m1 = new THREE.Matrix4().lookAt( this.position.clone().add(normal), this.position, this.up );
    this.quaternion.setFromRotationMatrix( m1 );
  }

  this.normal = normal || subFace.normal;
  this.a = this.normal.clone().normalize();
  this.b = this.a.dot( vertices[0].position );
  console.log("face inequaltiy:",this.a.x + "*x + " + this.a.y + "*y + " + this.a.z + "*z <= " + this.b);

  this.visible = false;
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
      this.visible = true;
      this.material = this.badPlaneMaterial;
    } else if (this.status.active) {
      //if (this.faceType === "face") {
      //  this.material = this.activefaceMaterial;
      //} else {
      this.visible = true;
      this.material = this.activePlaneMaterial;
      //}
    } else {
      //if (this.faceType === "face") {
      //  this.material = this.faceMaterial;
      //} else {
      this.visible = false;
      this.material = this.planeMaterial;
      //}
    }
  }
});

function Polyhedron(data) {
  THREE.Object3D.call(this);
  if (typeof data.normal !== "object") {
    data.normal = {};
  }
  var i;

  this.statusStack = [];

  if (data.type === "h") {
    Object.assign( data, this.hToV(data.h) );
  }

  var mean = data.vertex.reduce(function(s,v) {
    s[0] += v[0] / data.vertex.length;
    s[1] += v[1] / data.vertex.length;
    s[2] += v[2] / data.vertex.length;
    return s;
  },[0,0,0]);
  this.mid = new THREE.Vector3( mean[0], mean[1], mean[2] );
  this.radius = data.vertex.reduce(function(max,v) {
    return Math.max( max, new THREE.Vector3( v[0], v[1], v[2] ).distanceTo( this.mid ) );
  }.bind(this), 0);

  var vertices = [];
  for (i = 0; i < data.vertex.length; i++) {
    var vector = new THREE.Vector3(data.vertex[i][0], data.vertex[i][1], data.vertex[i][2]);
    var vertex = new Vertex(vector, i, this.radius / 100);
    vertices.push(vertex);
    this.add(vertex);
  }
  this.vertices = vertices;

  var edges = [];
  for (i = 0; i < data.edge.length; i++) {
    var index0 = data.edge[i][0];
    var index1 = data.edge[i][1];
    var edge = new Edge(vertices[index0], vertices[index1], this.radius / 100);
    edges.push(edge);
    this.add(edge);
  }
  this.edges = edges;

  var faces = [];
  for (i = 0; i < data.face.length; i++) {
    var v = data.face[i].map(function(index){
      return vertices[index];
    });
    var face = new Face(v, data.normal[i], this.radius / 100);
    if (face.faceType === "plane") {
      var arrow = new THREE.ArrowHelper( face.normal.clone().normalize(), face.position, this.radius / 2, 0x222200 );
      this.add( arrow );
    }
    faces.push(face);
    this.add(face);
  }
  this.faces = faces;

  this.direction = new THREE.Vector3(1,2,3);
  var dirArrow = new THREE.ArrowHelper( this.direction.clone().normalize(), this.mid, this.radius, 0xffa500 );
  dirArrow.visible = false;
  this.directionArrow = dirArrow;
  this.add( dirArrow );

  if (data.basis) {
    this.basis = new Basis(data.basis.map(function(faceIndex) {
      return faces[faceIndex];
    }), this).setActive();
    console.log(this.basis);
  } else {
    this.basis = null;
  }
}
Polyhedron.prototype = Object.create(THREE.Object3D.prototype);
Polyhedron.prototype.constructor = Polyhedron;
Object.assign(Polyhedron.prototype, {
  hToV: function (inequalities) {
    var eps = Math.pow( 2, -52 );

    var A = [];
    var b = [];
    var faceVertices = [];
    inequalities.forEach(function(ineq, i) {
      A[i] = new THREE.Vector3().fromArray( ineq[0] );
      b[i] = ineq[1];
      faceVertices[i] = [];
    });

    var vertices = [];
    var i,j,k,n = inequalities.length;
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        for (k = j + 1; k < n; k++) {
          var elements = [];
          A[i].toArray( elements, 0 );
          A[j].toArray( elements, 3 );
          A[k].toArray( elements, 6 );
          //vectors as row-vectors
          var AB = new THREE.Matrix3().fromArray( elements ).transpose();
          try {
            AB.getInverse( AB, true );
          } catch (e) {
            continue;
          }
          var vertex = new THREE.Vector3( b[i], b[j], b[k] ).applyMatrix3( AB );
          var feasible = A.every(function(a, index){
            return a.dot( vertex ) <= b[index] + eps;
          });
          if (!feasible) continue;
          var overdetermined = vertices.some(function(v, id) {
            if (v.distanceToManhattan( vertex ) > 3 * eps) return false;
            if (faceVertices[i].indexOf( id ) === -1) faceVertices[i].push( id );
            if (faceVertices[j].indexOf( id ) === -1) faceVertices[j].push( id );
            if (faceVertices[k].indexOf( id ) === -1) faceVertices[k].push( id );
            return true;
          });
          if (!overdetermined) {
            vertices.push( vertex );
            var id = vertices.length - 1;
            faceVertices[i].push( id );
            faceVertices[j].push( id );
            faceVertices[k].push( id );
          }
        }
      }
    }
    for (i = 0; i < vertices.length; i++) {
      vertices[i] = vertices[i].toArray();
    }
    var edges = [];
    for (i = 0; i < faceVertices.length; i++) {
      for (j = i + 1; j < faceVertices.length; j++) {
        var sharedVertices = faceVertices[i].filter(function(vertexId) {
          return faceVertices[j].indexOf(vertexId) > -1;
        });
        if (sharedVertices.length === 2) {
          edges.push( sharedVertices );
        } else if (sharedVertices.length > 2) {
          //same face
        }
      }
    }
    var normals = A.map(function(a){
      return a.toArray();
    });
    console.log({
      vertex: vertices,
      edge: edges,
      face: faceVertices,
      normal: normals
    });
    return {
      vertex: vertices,
      edge: edges,
      face: faceVertices,
      normal: normals
    };
  },
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
          var b = new Basis( [adjacent[i], adjacent[j], adjacent[k]], polyhedron );
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
    var p = this;
    var basis = p.basis;
    if (!basis || !basis.inverseMatrix) {
      basis = p.basis = p.getBasisForVertex(p.vertices[Math.floor(Math.random() * p.vertices.length)]).setActive();
    }
    if (!basis.vertex) {
      console.error("[getImprovingEdges] invalid basis (no vertex identified)");
      return [];
    }
    var v = basis.vertex.position;
    var improvingBasisChanges = [];
    var bestEdges = [0, []];
    for (var index = 0; index < basis.edgeDirections.length; index++) {
      var s = basis.edgeDirections[index];
      var sc = s.dot( p.direction );
      if (sc > 0) basis.faces[index].setStatus( "bad", true );
      if (sc >= bestEdges[0]) {
        if (sc > bestEdges[0]) {
          bestEdges = [sc, []];
        }
        bestEdges[1].push( [index, s] );
      }
    }
    bestEdges[1].forEach(function(a) {
      var index = a[0];
      var s = a[1];
      var bestLambda = [Infinity,[]];
      p.faces.forEach(function(face) {
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
    });

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
  backupStatus: function() {
    var s = {};
    s.stepState = this.stepState;
    s.basisFaces = this.basis && this.basis.faces.slice();
    this.statusStack.push(s);
  },
  rebuildStatus: function(s) {
    this.stepState = s.stepState;
    if (s.basisFaces) {
      this.basis = new Basis( s.basisFaces, this ).setActive();
    } else {
      this.basis = new Basis( [], this ).setActive();
    }
  },
  makeStep: function() {
    if (!this.stepState) {
      this.stepState = "basisFound";
    }
    this.backupStatus();
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
  },
  rewindStep: function() {
    var oldStatus = this.statusStack.pop();
    if (!oldStatus) {
      console.warn("There is no previous status");
      return;
    }
    this.rebuildStatus( oldStatus );
  }
});

function Basis (basisFaces, p) {
  //basis vectors are row-vectors in this.matrix
  if (p) {
    this.polyhedron = p;
  } else {
    this.polyhedron = polyhedron;
  }
  this.faces = basisFaces;
  this.vertices = this.polyhedron.sharedVertices(basisFaces);
  if (this.vertices.length === 1) {
    this.vertex = this.vertices[0];
  }
  if (basisFaces.length === 3) {
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
  }

  this.setActive = function() {
    //setting activity status of vertices
    this.polyhedron.vertices.forEach(function(vertex) {
      vertex.setStatus( "active", false );
    });
    this.vertices.forEach(function(vertex) {
      vertex.setStatus( "active", true );
    });
    //setting activity status of faces
    this.polyhedron.faces.forEach(function(face) {
      face.setStatus( "active", false );
    });
    for (var i = 0; i < basisFaces.length; i++) {
      basisFaces[i].setStatus( "active", true );
    }
    this.polyhedron.directionArrow.visible = false;
    if (this.vertex) {
      this.polyhedron.directionArrow.visible = true;
      this.polyhedron.directionArrow.position.copy( this.vertex.position );
      moveCamera( this.vertex.getWorldPosition() );
    }
    return this;
  };

  this.changeBasis = function (indexOut, newFace) {
    console.log("changing basis, current faces:",this.faces);
    this.polyhedron.vertex && this.polyhedron.vertex.setStatus( "active", false );
    this.faces[indexOut].setStatus( "active", false );
    for (var i = 0; i < this.faces.length; i++) {
      this.faces[i].setStatus( "bad", false );
    }
    this.faces.splice( indexOut, 1, newFace );
    Basis.call(this, this.faces, this.polyhedron);
    return this;
  };
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function moveCamera (finalPos, dist) {
  if (cameraTween) cameraTween.stop();
  if (dist === undefined) {
    dist = camera.position.length();
  }
  var startPos = camera.position.clone();
  var cameraUpStart = camera.up.clone();
  var finalAngle = finalPos.angleTo( startPos );
  var axis = new THREE.Vector3().crossVectors( startPos, finalPos ).normalize();

  cameraTween = new TWEEN.Tween({ angle: 0, l: camera.position.length() })
  .to({ angle: finalAngle, l: dist }, 500)
  .easing( TWEEN.Easing.Quadratic.InOut )
  .onUpdate(function() {
    if (this.angle !== 0) {
      var q = new THREE.Quaternion().setFromAxisAngle( axis, this.angle );
      camera.up.copy( cameraUpStart.clone().applyQuaternion( q ) );
      camera.position.copy( startPos.clone().applyQuaternion( q ) );
    }
    camera.position.setLength( this.l );
  })
  .start();
}

function animate() {

  //restrict zoom-range
  if (camera.position.length() < camera.minDistance) {
    camera.position.setLength(camera.minDistance);
  } else if (camera.position.length() > camera.maxDistance) {
    camera.position.setLength(camera.maxDistance);
  }

  requestAnimationFrame( animate );

  TWEEN.update();

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
