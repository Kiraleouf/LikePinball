import './style.css';
import { SectorEditor } from './editor/SectorEditor';
import { PinballPrototype } from './three/PinballPrototype';

const root = document.querySelector<HTMLElement>('#game');
if (!root) throw new Error('Conteneur #game absent');

if (new URLSearchParams(location.search).has('editor')) new SectorEditor(root);
else void new PinballPrototype(root).start();
