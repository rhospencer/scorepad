<script lang="ts">
  import { initialOf, seatColor } from '../lib/avatar';

  interface Props {
    name: string;
    /** 0-based seat; picks the color. */
    seat: number;
    /** Shown instead of the initial when the player picked one. */
    emoji?: string;
    /** Diameter in px. */
    size?: number;
  }

  let { name, seat, emoji, size = 40 }: Props = $props();
</script>

<!-- Decorative: the player's name is always next to it or in a hidden label. -->
<span
  class="avatar"
  aria-hidden="true"
  style:width="{size}px"
  style:height="{size}px"
  style:font-size="{Math.round(size * (emoji ? 0.6 : 0.43))}px"
  style:background={seatColor(seat)}>{emoji || initialOf(name, seat)}</span
>

<style>
  .avatar {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--avatar-ink);
    font-weight: 800;
    line-height: 1;
  }
</style>
