<script>
  // "Continue with Google" via Google Identity Services. Renders nothing unless
  // VITE_GOOGLE_CLIENT_ID is set. The ID token is exchanged for a backend session.
  import { A, api, setToken } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { friendlyError } from '$lib/errors.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let { onerror = () => {} } = $props();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  let box;

  async function onCredential(resp) {
    try {
      const data = await api('/api/auth/google', { method: 'POST', body: { id_token: resp.credential } });
      setToken(data.token, data.refresh_token);
      if (data.user) A.user = data.user;
      goto('/contacts');
    } catch (err) {
      onerror(friendlyError(err, t));
    }
  }

  function render() {
    window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential });
    window.google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', width: 324, text: 'continue_with' });
  }

  onMount(() => {
    if (!clientId) return;
    if (window.google?.accounts?.id) return render();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  });
</script>

{#if clientId}
  <div class="google" bind:this={box}></div>
{/if}

<style>
  .google { display: flex; justify-content: center; margin-top: 16px; min-height: 44px; }
</style>
