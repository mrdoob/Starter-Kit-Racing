import * as THREE from 'three';

const POOL_SIZE = 8;
const LIFETIME = 0.11;

const _coreGeom = new THREE.IcosahedronGeometry( 0.22, 0 );
const _flareGeom = new THREE.PlaneGeometry( 0.9, 0.9 );

export class MuzzleFlash {

	constructor( scene ) {

		this.scene = scene;
		this.cores = [];
		this.flares = [];
		this.index = 0;

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const coreMat = new THREE.MeshBasicMaterial( {
				color: 0xffc266, transparent: true, opacity: 0, depthWrite: false,
			} );
			const core = new THREE.Mesh( _coreGeom, coreMat );
			core.visible = false;
			scene.add( core );

			const flareMat = new THREE.MeshBasicMaterial( {
				color: 0xfff1b0, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
			} );
			const flare = new THREE.Mesh( _flareGeom, flareMat );
			flare.visible = false;
			scene.add( flare );

			this.cores.push( { mesh: core, material: coreMat, life: 0 } );
			this.flares.push( { mesh: flare, material: flareMat, life: 0 } );

		}

	}

	burst( x, y, z ) {

		const i = this.index;
		this.index = ( this.index + 1 ) % POOL_SIZE;

		const core = this.cores[ i ];
		core.mesh.visible = true;
		core.mesh.position.set( x, y, z );
		core.mesh.scale.setScalar( 1 );
		core.material.opacity = 1;
		core.life = LIFETIME;

		const flare = this.flares[ i ];
		flare.mesh.visible = true;
		flare.mesh.position.set( x, y, z );
		flare.mesh.rotation.z = Math.random() * Math.PI;
		flare.mesh.scale.setScalar( 1.2 );
		flare.material.opacity = 1;
		flare.life = LIFETIME;

	}

	update( dt, cameraQuat ) {

		for ( const c of this.cores ) {

			if ( c.life <= 0 ) continue;
			c.life -= dt;
			const t = Math.max( 0, c.life / LIFETIME );
			c.mesh.scale.setScalar( 0.4 + t * 0.8 );
			c.material.opacity = t;
			if ( c.life <= 0 ) c.mesh.visible = false;

		}

		for ( const f of this.flares ) {

			if ( f.life <= 0 ) continue;
			f.life -= dt;
			const t = Math.max( 0, f.life / LIFETIME );
			if ( cameraQuat ) f.mesh.quaternion.copy( cameraQuat );
			f.mesh.scale.setScalar( 0.5 + ( 1 - t ) * 1.6 );
			f.material.opacity = t * 0.9;
			if ( f.life <= 0 ) f.mesh.visible = false;

		}

	}

}
