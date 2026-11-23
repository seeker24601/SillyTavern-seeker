// The persona buttons (the Persona entry in the navigation and the one in the composer) show
// the active persona's picture instead of the face icon, when the persona has one of its own.
// Sets --seeker-persona-avatar and data-seeker-persona-avatar on the page; style.css draws it.
import { user_avatar } from '../../../personas.js';

const DEFAULT_AVATAR = 'user-default.png';

export function mountPersonaAvatar() {
    const { eventSource, eventTypes, getThumbnailUrl } = SillyTavern.getContext();
    const root = document.documentElement;
    let shown = null;
    const update = () => {
        const avatar = user_avatar && user_avatar !== DEFAULT_AVATAR ? user_avatar : '';
        if (avatar === shown) return;
        shown = avatar;
        if (!avatar) {
            root.removeAttribute('data-seeker-persona-avatar');
            root.style.removeProperty('--seeker-persona-avatar');
            return;
        }
        const url = new URL(getThumbnailUrl('persona', avatar), location.href).href;
        root.style.setProperty('--seeker-persona-avatar', `url("${url}")`);
        root.dataset.seekerPersonaAvatar = '';
    };
    for (const name of ['APP_READY', 'PERSONA_CHANGED', 'PERSONA_UPDATED', 'PERSONA_CREATED', 'PERSONA_RENAMED', 'CHAT_CHANGED', 'SETTINGS_UPDATED']) {
        if (eventTypes[name]) eventSource.on(eventTypes[name], () => setTimeout(update));
    }
    update();
}
