import './style.css';
import { PinballPrototype } from './three/PinballPrototype';

const root = document.querySelector<HTMLElement>('#game');
if (!root) throw new Error('Conteneur #game absent');

void new PinballPrototype(root).start();
