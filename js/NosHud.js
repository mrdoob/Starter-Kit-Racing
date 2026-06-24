import { NOS_DURATION } from './Vehicle.js';

export class NosHud {

	constructor( controls ) {

		this._controls = controls;

		const css = document.createElement( 'style' );
		css.textContent = `
			.nos-hud {
				position: fixed;
				left: 14px;
				bottom: 14px;
				z-index: 20;
				font-family: system-ui, sans-serif;
				user-select: none;
				pointer-events: none;
			}
			.nos-hud__label-row {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 5px;
			}
			.nos-hud__key-btn {
				appearance: none;
				border: 0;
				margin: 0;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 22px;
				height: 22px;
				padding: 0 7px;
				border-radius: 5px;
				background: #ffffff;
				color: #1a1a1a;
				font-size: 11px;
				font-weight: 800;
				line-height: 1;
				font-family: inherit;
				box-shadow:
					0 1px 0 rgba( 255, 255, 255, 0.65 ) inset,
					0 2px 4px rgba( 0, 0, 0, 0.35 );
				pointer-events: auto;
				cursor: pointer;
				touch-action: manipulation;
			}
			.nos-hud__key-btn:hover {
				filter: brightness( 1.04 );
			}
			.nos-hud__key-btn:active {
				transform: translateY( 1px );
				box-shadow:
					0 1px 0 rgba( 255, 255, 255, 0.4 ) inset,
					0 1px 2px rgba( 0, 0, 0, 0.4 );
			}
			.nos-hud__key-btn--empty {
				opacity: 0.4;
			}
			.nos-hud__text {
				display: flex;
				flex-direction: column;
				gap: 1px;
			}
			.nos-hud__title {
				font-size: 10px;
				font-weight: 700;
				letter-spacing: 0.08em;
				color: rgba( 255, 255, 255, 0.55 );
				text-shadow: 0 1px 2px rgba( 0, 0, 0, 0.5 );
			}
			.nos-hud__pct {
				font-size: 11px;
				font-weight: 700;
				font-variant-numeric: tabular-nums;
				color: rgba( 255, 255, 255, 0.92 );
				text-shadow: 0 1px 2px rgba( 0, 0, 0, 0.55 );
			}
			.nos-hud__track {
				width: 112px;
				height: 8px;
				border-radius: 4px;
				background: rgba( 0, 0, 0, 0.45 );
				box-shadow: inset 0 1px 2px rgba( 0, 0, 0, 0.45 );
				overflow: hidden;
				position: relative;
			}
			.nos-hud__fill {
				position: absolute;
				left: 0;
				top: 0;
				bottom: 0;
				width: 100%;
				transform-origin: left center;
				transform: scaleX( 1 );
				border-radius: 4px;
				background: linear-gradient( 180deg, #ff6b4a 0%, #c41e3a 55%, #8b1538 100% );
				box-shadow: 0 0 10px rgba( 255, 60, 80, 0.45 );
				transition: transform 0.08s ease-out;
			}
		`;
		document.head.appendChild( css );

		this.root = document.createElement( 'div' );
		this.root.className = 'nos-hud';
		this.root.innerHTML = `
			<div class="nos-hud__label-row">
				<button type="button" class="nos-hud__key-btn">X</button>
				<div class="nos-hud__text">
					<span class="nos-hud__title">NOS</span>
					<span class="nos-hud__pct"><span class="nos-hud__percent">100</span>% left</span>
				</div>
			</div>
			<div class="nos-hud__track">
				<div class="nos-hud__fill"></div>
			</div>
		`;
		document.body.appendChild( this.root );

		this.fill = this.root.querySelector( '.nos-hud__fill' );
		this.percentEl = this.root.querySelector( '.nos-hud__percent' );
		this.keyBtn = this.root.querySelector( '.nos-hud__key-btn' );

		this.keyBtn.setAttribute( 'aria-label', 'Hold to use NOS boost' );

		const setHeld = ( on ) => {

			this._controls.setNosUiHeld( on );

		};

		this.keyBtn.addEventListener( 'pointerdown', ( e ) => {

			e.preventDefault();
			this.keyBtn.setPointerCapture( e.pointerId );
			setHeld( true );

		} );

		this.keyBtn.addEventListener( 'pointerup', ( e ) => {

			e.preventDefault();
			setHeld( false );
			try {

				this.keyBtn.releasePointerCapture( e.pointerId );

			} catch ( _ ) {}

		} );

		this.keyBtn.addEventListener( 'pointercancel', () => setHeld( false ) );

		this.keyBtn.addEventListener( 'lostpointercapture', () => setHeld( false ) );

		this.keyBtn.addEventListener( 'keydown', ( e ) => {

			if ( e.code === 'Space' || e.code === 'Enter' ) {

				e.preventDefault();
				setHeld( true );

			}

		} );

		this.keyBtn.addEventListener( 'keyup', ( e ) => {

			if ( e.code === 'Space' || e.code === 'Enter' ) {

				e.preventDefault();
				setHeld( false );

			}

		} );

	}

	update( vehicle ) {

		const frac = Math.min( 1, Math.max( 0, vehicle.nosTankRemaining / NOS_DURATION ) );
		this.fill.style.transform = `scaleX( ${ frac } )`;

		const pct = Math.round( frac * 100 );
		this.percentEl.textContent = String( pct );

		this.keyBtn.classList.toggle( 'nos-hud__key-btn--empty', pct <= 0 );
		this.keyBtn.setAttribute( 'aria-disabled', pct <= 0 ? 'true' : 'false' );

	}

}
