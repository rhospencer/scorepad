<script lang="ts">
  import QRCode from 'qrcode';
  import Avatar from './Avatar.svelte';

  /** The host's "scan to join" card: QR code, room code, and link. */
  interface Props {
    code: string;
    /** Null when this computer has no network address phones could reach. */
    url: string | null;
    joined: number;
    openSlots: number;
    onclose: () => void;
    /** Desktop: a big QR code readable across the table, with who has joined. */
    large?: boolean;
    joinedPlayers?: { name: string; emoji?: string; seat: number }[];
    /** The close button's words ("Stop inviting" in setup, "Done" during a game). */
    closeLabel?: string;
    /** Replaces the "Waiting for players" line, e.g. for one player's own QR code. */
    status?: string;
  }

  let {
    code,
    url,
    joined,
    openSlots,
    onclose,
    large = false,
    joinedPlayers = [],
    closeLabel = 'Stop inviting',
    status,
  }: Props = $props();

  let qr = $state('');
  let copied = $state(false);

  $effect(() => {
    const link = url;
    if (!link) return;
    let cancelled = false;
    QRCode.toString(link, { type: 'svg', margin: 1, color: { dark: '#0F1420', light: '#F2EFE8' } })
      .then((svg) => {
        if (!cancelled) qr = svg;
      })
      .catch(() => (qr = ''));
    return () => {
      cancelled = true;
    };
  });

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard needs https or localhost; the link is on screen to type instead.
    }
  }
</script>

<section class="invite" class:large aria-label="Invite players by phone">
  {#if url}
    <div class="qr" role="img" aria-label="QR code for the join link">
      <!-- SVG built locally by the qrcode library from our own URL. -->
      {@html qr}
    </div>
    <div class="info">
      <p class="label">Scan, or go to</p>
      <button type="button" class="link" onclick={copy} aria-label="Copy join link">{url.replace(/^https?:\/\//, '')}</button>
      <p class="label">Game code</p>
      <p class="code">{code}</p>
    </div>
  {:else}
    <p class="warn">
      This computer isn’t on a network phones can reach. Connect it to Wi-Fi, then reopen the invite.
    </p>
  {/if}
  {#if large}
    <div class="joined">
      <p class="label">Joined by phone · {joined}</p>
      {#if joinedPlayers.length > 0}
        <ul>
          {#each joinedPlayers as p (p.seat)}
            <li><Avatar name={p.name} seat={p.seat} emoji={p.emoji} size={56} /><span>{p.name}</span></li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Names pop in here as people join.</p>
      {/if}
      <p class="muted">Anyone on the same Wi-Fi can join.</p>
    </div>
  {/if}
  <div class="foot">
    <span role="status">
      {copied ? 'Link copied' : (status ?? (joined === 0 ? 'Waiting for players…' : `${joined} joined by phone`))}
      {#if openSlots === 0 && !copied && !status}· full{/if}
    </span>
    <button type="button" class="close" onclick={onclose}>{closeLabel}</button>
  </div>
</section>

<style>
  .invite {
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: 14px;
    padding: 14px;
    border-radius: 20px;
    background: var(--surface-2);
    border: 1px solid var(--amber);
    margin-bottom: 16px;
  }
  .qr {
    width: 132px;
    height: 132px;
    border-radius: 12px;
    overflow: hidden;
    background: #f2efe8;
  }
  .qr :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .label {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .link {
    margin: 2px 0 10px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font-weight: 650;
    font-size: 14px;
    text-align: left;
    word-break: break-all;
    cursor: pointer;
  }
  .code {
    margin: 0;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--amber);
  }
  .invite.large {
    grid-template-columns: 220px 1fr;
    gap: 24px;
    padding: 28px;
    border-radius: 24px;
    margin: 0;
  }
  .large .qr {
    width: 220px;
    height: 220px;
    border-radius: 16px;
    padding: 10px;
  }
  .large .link {
    font-size: 17px;
  }
  .large .code {
    font-size: 64px;
    line-height: 1;
  }
  .joined {
    grid-column: 1 / -1;
  }
  .joined ul {
    list-style: none;
    margin: 10px 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }
  .joined li {
    width: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 14px;
  }
  .joined li span {
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  .warn {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--amber);
  }
  .foot {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--muted);
    font-size: 14px;
  }
  .close {
    min-height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font-weight: 650;
    cursor: pointer;
  }
</style>
