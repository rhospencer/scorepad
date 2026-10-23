import { mount } from 'svelte';
import './themes.css';
import './app.css';
import { applyTheme, loadTheme } from './lib/theme';
import App from './App.svelte';
import Join from './screens/Join.svelte';

// Before anything renders, so the saved theme shows from the first frame.
applyTheme(loadTheme());

const target = document.getElementById('app')!;

// Phones open /join/ABCD (from the host's QR code) and only get the join screen.
const join = location.pathname.match(/^\/join(?:\/([A-Za-z]{4}))?\/?$/);

const app = join ? mount(Join, { target, props: { initialCode: join[1] ?? '' } }) : mount(App, { target });

export default app;
