init()

function init() {

				var width = window.innerWidth || 2;
				var height = window.innerHeight || 2;

				container = document.createElement( 'div' );
				document.body.appendChild( container );

				var info = document.createElement( 'div' );
				info.style.position = 'absolute';
				info.style.top = '10px';
				info.style.width = '100%';
				info.style.textAlign = 'center';
				info.innerHTML = 'Drag to change the view';
				container.appendChild( info );

				camera = new THREE.PerspectiveCamera( 70, width / height, 1, 1000 );
				camera.position.y = 150;
				camera.position.z = 500;

				controls = new THREE.TrackballControls( camera );

				scene = new THREE.Scene();

				var light = new THREE.PointLight( 0xffffff );
				light.position.set( 500, 500, 500 );
				scene.add( light );

				var light = new THREE.PointLight( 0xffffff, 0.25 );
				light.position.set( - 500, - 500, - 500 );
				scene.add( light );

				sphere = new THREE.Mesh( new THREE.SphereGeometry( 200, 20, 10 ), new THREE.MeshLambertMaterial() );
				scene.add( sphere );

				// Plane

				plane = new THREE.Mesh( new THREE.PlaneBufferGeometry( 400, 400 ), new THREE.MeshBasicMaterial( { color: 0xe0e0e0 } ) );
				plane.position.y = - 200;
				plane.rotation.x = - Math.PI / 2;
				scene.add( plane );

				renderer = new THREE.CanvasRenderer();
				renderer.setClearColor( 0xf0f0f0 );
				renderer.setSize( width, height );
				// container.appendChild( renderer.domElement );

				effect = new THREE.AsciiEffect( renderer );
				effect.setSize( width, height );
				container.appendChild( effect.domElement );

				stats = new Stats();
				container.appendChild( stats.dom );

				//

				window.addEventListener( 'resize', onWindowResize, false );

			}
