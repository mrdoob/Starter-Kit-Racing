const LABELS = [ 'Eagle', 'Third person', 'Hood' ];

export class CameraHud {

	constructor( { onSwap } ) {

		this._onSwap = onSwap;
		this._build();
		this._syncTop();
		window.addEventListener( 'resize', () => this._syncTop() );

	}

	_build() {

		const style = document.createElement( 'style' );
		style.textContent = `
			#camera-hud {
				position: absolute;
				left: 12px;
				z-index: 10;
				font: 600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				user-select: none;
				min-width: 140px;
			}
			#camera-hud .cam-switch {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
				width: 100%;
				padding: 8px 12px;
				margin: 0 0 8px 0;
				border: none;
				border-radius: 8px;
				background: #fff;
				color: #000;
				font: inherit;
				font-weight: 700;
				letter-spacing: 0.04em;
				cursor: pointer;
				box-shadow: 0 2px 8px rgba(0,0,0,0.2);
			}
			#camera-hud .cam-switch svg {
				flex-shrink: 0;
				width: 20px;
				height: 20px;
			}
			#camera-hud .cam-switch:hover { filter: brightness(0.96); }
			#camera-hud .cam-switch:active { transform: scale(0.98); }
			#camera-hud .cam-list {
				margin: 0;
				padding: 10px 12px 10px 1.35em;
				list-style: disc;
				line-height: 1.55;
				background: rgba(0,0,0,0.45);
				border-radius: 10px;
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
			}
			#camera-hud .cam-list li {
				margin: 0;
				padding: 0;
			}
			#camera-hud .cam-list li.is-active {
				color: #fff;
				-webkit-text-stroke: 0.9px #000;
				paint-order: stroke fill;
			}
			#camera-hud .cam-list li.is-idle {
				color: rgba(255,255,255,0.38);
				-webkit-text-stroke: 0;
			}
		`;
		document.head.appendChild( style );

		this.root = document.createElement( 'div' );
		this.root.id = 'camera-hud';

		const btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'cam-switch';
		btn.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
			'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
			'<circle cx="12" cy="13" r="4"/>' +
			'</svg>' +
			'<span>Switch (C)</span>';
		btn.addEventListener( 'click', () => this._onSwap() );
		this.root.appendChild( btn );

		const ul = document.createElement( 'ul' );
		ul.className = 'cam-list';
		this._items = [];
		for ( let i = 0; i < 3; i ++ ) {

			const li = document.createElement( 'li' );
			li.textContent = LABELS[ i ];
			ul.appendChild( li );
			this._items.push( li );

		}

		this.root.appendChild( ul );
		document.body.appendChild( this.root );

	}

	_syncTop() {

		const lap = document.getElementById( 'lap-timer' );
		if ( lap ) {

			const r = lap.getBoundingClientRect();
			this.root.style.top = `${ Math.round( r.bottom + 8 ) }px`;

		} else {

			this.root.style.top = '12px';

		}

	}

	update( cam ) {

		const mode = cam.getHudMode();
		for ( let i = 0; i < 3; i ++ ) {

			const li = this._items[ i ];
			const on = i === mode;
			li.classList.toggle( 'is-active', on );
			li.classList.toggle( 'is-idle', ! on );

		}

	}

}
