import * as THREE from 'three';

const STEAM_POOL = 18;
const STEAM_LIFE = 0.8;
const ARC_POOL = 8;
const ARC_LIFE = 0.14;
const ARC_POINTS = 6;
const RING_POOL = 3;
const RING_LIFE = 0.6;

const _steamGeom = new THREE.SphereGeometry( 0.15, 8, 6 );
const _ringGeom = new THREE.TorusGeometry( 1.0, 0.12, 8, 32 );

export class TransformFX {

	constructor( scene ) {

		this.scene = scene;

		// Steam puffs
		this.steam = [];
		for ( let i = 0; i < STEAM_POOL; i ++ ) {

			const mat = new THREE.MeshStandardMaterial( {
				color: 0xd6d8dd, roughness: 1, transparent: true, opacity: 0, depthWrite: false,
			} );
			const mesh = new THREE.Mesh( _steamGeom, mat );
			mesh.visible = false;
			scene.add( mesh );
			this.steam.push( { mesh, material: mat, life: 0, vx: 0, vy: 0, vz: 0 } );

		}
		this.steamIndex = 0;

		// Electric arcs
		this.arcs = [];
		for ( let i = 0; i < ARC_POOL; i ++ ) {

			const positions = new Float32Array( ARC_POINTS * 3 );
			const geo = new THREE.BufferGeometry();
			geo.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
			const mat = new THREE.LineBasicMaterial( {
				color: 0x7ae6ff, transparent: true, opacity: 0, linewidth: 2,
			} );
			const line = new THREE.Line( geo, mat );
			line.frustumCulled = false;
			line.visible = false;
			scene.add( line );
			this.arcs.push( {
				line, material: mat, positions, geo, life: 0,
				a: new THREE.Vector3(), b: new THREE.Vector3(),
			} );

		}
		this.arcIndex = 0;

		// Shockwave rings
		this.rings = [];
		for ( let i = 0; i < RING_POOL; i ++ ) {

			const mat = new THREE.MeshBasicMaterial( {
				color: 0xfff0a0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
			} );
			const mesh = new THREE.Mesh( _ringGeom, mat );
			mesh.rotation.x = - Math.PI / 2;
			mesh.visible = false;
			scene.add( mesh );
			this.rings.push( { mesh, material: mat, life: 0, scaleMax: 4 } );

		}
		this.ringIndex = 0;

		// Screen flash (fullscreen quad in ortho camera-facing space)
		this.flashMesh = new THREE.Mesh(
			new THREE.PlaneGeometry( 2, 2 ),
			new THREE.MeshBasicMaterial( {
				color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
			} )
		);
		this.flashMesh.frustumCulled = false;
		this.flashMesh.renderOrder = 10000;
		scene.add( this.flashMesh );
		this.flashOpacityTarget = 0;
		this.flashOpacity = 0;

	}

	steamBurst( x, y, z, count = 4 ) {

		for ( let i = 0; i < count; i ++ ) {

			const p = this.steam[ this.steamIndex ];
			this.steamIndex = ( this.steamIndex + 1 ) % STEAM_POOL;
			p.mesh.visible = true;
			const a = Math.random() * Math.PI * 2;
			const r = Math.random() * 0.3;
			p.mesh.position.set( x + Math.cos( a ) * r, y + 0.1, z + Math.sin( a ) * r );
			p.mesh.scale.setScalar( 0.6 + Math.random() * 0.5 );
			p.material.opacity = 0.9;
			p.vx = Math.cos( a ) * ( 0.8 + Math.random() );
			p.vz = Math.sin( a ) * ( 0.8 + Math.random() );
			p.vy = 1.2 + Math.random() * 0.8;
			p.life = STEAM_LIFE;

		}

	}

	arc( aVec, bVec ) {

		const p = this.arcs[ this.arcIndex ];
		this.arcIndex = ( this.arcIndex + 1 ) % ARC_POOL;
		p.a.copy( aVec );
		p.b.copy( bVec );
		p.line.visible = true;
		p.material.opacity = 1;
		p.life = ARC_LIFE;
		this._refreshArc( p );

	}

	_refreshArc( p ) {

		const pos = p.positions;
		for ( let i = 0; i < ARC_POINTS; i ++ ) {

			const t = i / ( ARC_POINTS - 1 );
			const jx = ( Math.random() - 0.5 ) * 0.2 * ( i === 0 || i === ARC_POINTS - 1 ? 0 : 1 );
			const jy = ( Math.random() - 0.5 ) * 0.25 * ( i === 0 || i === ARC_POINTS - 1 ? 0 : 1 );
			const jz = ( Math.random() - 0.5 ) * 0.2 * ( i === 0 || i === ARC_POINTS - 1 ? 0 : 1 );
			pos[ i * 3 + 0 ] = p.a.x + ( p.b.x - p.a.x ) * t + jx;
			pos[ i * 3 + 1 ] = p.a.y + ( p.b.y - p.a.y ) * t + jy;
			pos[ i * 3 + 2 ] = p.a.z + ( p.b.z - p.a.z ) * t + jz;

		}

		p.geo.attributes.position.needsUpdate = true;
		p.geo.computeBoundingSphere();

	}

	shockwave( x, y, z, scaleMax = 4 ) {

		const r = this.rings[ this.ringIndex ];
		this.ringIndex = ( this.ringIndex + 1 ) % RING_POOL;
		r.mesh.visible = true;
		r.mesh.position.set( x, y + 0.05, z );
		r.mesh.scale.setScalar( 0.2 );
		r.material.opacity = 1;
		r.life = RING_LIFE;
		r.scaleMax = scaleMax;

	}

	flash( intensity = 0.15 ) {

		this.flashOpacityTarget = Math.max( this.flashOpacityTarget, intensity );

	}

	update( dt, camera ) {

		for ( const s of this.steam ) {

			if ( s.life <= 0 ) continue;
			s.life -= dt;
			s.mesh.position.x += s.vx * dt;
			s.mesh.position.y += s.vy * dt;
			s.mesh.position.z += s.vz * dt;
			s.vy *= Math.max( 0, 1 - dt * 0.9 );
			const t = Math.max( 0, s.life / STEAM_LIFE );
			s.material.opacity = t * 0.9;
			s.mesh.scale.setScalar( s.mesh.scale.x + dt * 0.6 );
			if ( s.life <= 0 ) s.mesh.visible = false;

		}

		for ( const a of this.arcs ) {

			if ( a.life <= 0 ) continue;
			a.life -= dt;
			const t = Math.max( 0, a.life / ARC_LIFE );
			a.material.opacity = t;
			this._refreshArc( a );
			if ( a.life <= 0 ) a.line.visible = false;

		}

		for ( const r of this.rings ) {

			if ( r.life <= 0 ) continue;
			r.life -= dt;
			const prog = 1 - Math.max( 0, r.life / RING_LIFE );
			r.mesh.scale.setScalar( 0.2 + prog * r.scaleMax );
			r.material.opacity = Math.max( 0, 1 - prog );
			if ( r.life <= 0 ) r.mesh.visible = false;

		}

		// Screen flash: ramp up instantly, decay smooth
		if ( this.flashOpacityTarget > this.flashOpacity ) this.flashOpacity = this.flashOpacityTarget;
		this.flashOpacity *= Math.max( 0, 1 - dt * 9 );
		this.flashOpacityTarget *= Math.max( 0, 1 - dt * 12 );
		this.flashMesh.material.opacity = this.flashOpacity;

		if ( camera ) {

			camera.updateMatrixWorld();
			this.flashMesh.position.copy( camera.position );
			this.flashMesh.quaternion.copy( camera.quaternion );
			this.flashMesh.translateZ( - 1 );

		}

	}

}
