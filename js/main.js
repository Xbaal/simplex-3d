import "JSON!models.json";

let camera, controls, scene, renderer, domEvents, stats;

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
    renderer = new THREE.WebGLRenderer( {antialias:true} );
  else //TODO: make the CanvasRenderer work properly or remove it
    renderer = new THREE.CanvasRenderer();
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  container = document.getElementById( 'ThreeJS' );
  container.appendChild( renderer.domElement );
  // EVENTS
  domEvents = new THREEx.DomEvents(camera, renderer.domElement)
  //THREEx.WindowResize(renderer, camera);
  // CONTROLS
  controls = new THREE.TrackballControls( camera, renderer.domElement );
  controls.noPan = true;
  // LIGHT
  light = new THREE.AmbientLight( 0x222222 , 7);
  scene.add( light );
  // SKYBOX
  let skyBoxGeometry = new THREE.CubeGeometry( 8000, 8000, 8000 );
  let skyBoxMaterial = new THREE.MeshBasicMaterial( { color: 0xccccff, side: THREE.BackSide } );
  let skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );
  scene.add(skyBox);


  function displayPolyhedron(data) {
    polyhedronMesh = polyhedronDataToMesh(data);
    scene.add(polyhedronMesh);
  }


  displayPolyhedron(MODELS.Cube)





  window.addEventListener( 'resize', onWindowResize, false );

}

function loadJSON(url) {

}

function cylinderMesh(point1, point2, material)
{
  var direction = new THREE.Vector3().subVectors(point2, point1);
  var arrow = new THREE.ArrowHelper(direction.clone().normalize(), point1);
  var edgeGeometry = new THREE.CylinderGeometry( 2, 2, direction.length(), 8, 4 );
  var edge = new THREE.Mesh(edgeGeometry, material);
  edge.position.addVectors(point1, direction.multiplyScalar(0.5));
  edge.rotation.setFromQuaternion(arrow.quaternion);
  return edge;

  // the result should align with:
  //   scene.add( new THREE.ArrowHelper( direction.clone().normalize(), point1, direction.length()) );
}

function polyhedronDataToMesh(data)
{
  var polyhedron = new THREE.Object3D();

  // convert vertex data to THREE.js vectors
  var vertex = []
  for (var i = 0; i < data.vertex.length; i++)
    vertex.push( new THREE.Vector3( data.vertex[i][0], data.vertex[i][1], data.vertex[i][2] ).multiplyScalar(100) );

  var vertexGeometry = new THREE.SphereGeometry( 6, 12, 6 );
  var vertexMaterial = new THREE.MeshLambertMaterial( { color: 0x222244 } );
  var vertexHoverMaterial = new THREE.MeshLambertMaterial( { color: 0x662222 } );
  var vertexSingleMesh = new THREE.Mesh( vertexGeometry, vertexMaterial );

  for (var i = 0; i < data.vertex.length; i++)
  {
    let vMesh = vertexSingleMesh.clone();
    vMesh.position.add(vertex[i]);
    polyhedron.add( vMesh );
    domEvents.addEventListener(vMesh, 'click', (mesh) => {
      vMesh.scale.multiplyScalar(2)
      setTimeout(() => {
        vMesh.scale.multiplyScalar(0.5)
      },2000)
    }, false)
    //mousemove is here not really useful like this...
    domEvents.addEventListener(vMesh, 'mouseover', (event) => {
      event.target.material = vertexHoverMaterial
    }, false)
    domEvents.addEventListener(vMesh, 'mouseout', (event) => {
      event.target.material = vertexMaterial
    })
    domEvents.addEventListener(vMesh, 'contextmenu', (mesh) => {
      if (vMesh.material == vertexMaterial) {
        vMesh.material = vertexHoverMaterial
      } else {
        vMesh.material = vertexMaterial
      }
    }, false)
  }

  // convert edge data to cylinders
  var edgeMaterial = new THREE.MeshLambertMaterial( {color: 0x666666} );
  var edgeAmalgam = new THREE.Geometry();
  for (var i = 0; i < data.edge.length; i++)
  {
    var index0 = data.edge[i][0];
    var index1 = data.edge[i][1];
    var eMesh = cylinderMesh( vertex[index0], vertex[index1], edgeMaterial );
    edgeAmalgam.mergeMesh( eMesh );
  }
  var edgeMesh = new THREE.Mesh( edgeAmalgam, edgeMaterial );
  polyhedron.add( edgeMesh );

  // convert face data to a single (triangulated) geometry
  var frontFaceMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff, side: THREE.FrontSide, transparent: true, opacity:0.5 } );
  var backFaceMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff, side: THREE.BackSide, transparent: true, opacity:0.5 } );

  var geometry = new THREE.Geometry();
  geometry.vertices = vertex;
  var faceIndex = 0;
  for (var faceNum = 0; faceNum < data.face.length; faceNum++)
  {
    for (var i = 0; i < data.face[faceNum].length - 2; i++)
    {
      geometry.faces[faceIndex] = new THREE.Face3( data.face[faceNum][0], data.face[faceNum][i+1], data.face[faceNum][i+2] );
      geometry.faces[faceIndex].color = 0xffffff;
      faceIndex++;
    }
  }

  //TODO: think about necessity (?)
  //geometry.computeFaceNormals();
  //geometry.computeVertexNormals();

  //backSides have to be added first (or render order has to be tweaked)
  backFace = new THREE.Mesh(geometry, backFaceMaterial);
  polyhedron.add(backFace);
  frontFace = new THREE.Mesh(geometry, frontFaceMaterial);
  polyhedron.add(frontFace);

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
