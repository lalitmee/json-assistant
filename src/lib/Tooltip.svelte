<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    align = "center",
    placement = "bottom",
    children,
  }: {
    label: string;
    align?: "start" | "center" | "end";
    placement?: "top" | "bottom";
    children: Snippet;
  } = $props();
</script>

<span
  class="tooltip-anchor"
  data-align={align}
  {...placement !== "bottom" ? { "data-placement": placement } : {}}
>
  {@render children()}
  <span class="tooltip-bubble" role="tooltip">{label}</span>
</span>

<style>
  .tooltip-anchor {
    position: relative;
    display: inline-flex;
    flex: none;
  }
  .tooltip-bubble {
    position: absolute;
    z-index: 30;
    top: calc(100% + 7px);
    left: 50%;
    width: max-content;
    max-width: min(280px, 85vw);
    padding: 6px 10px;
    border-radius: 6px;
    background: #30333b;
    color: #fff;
    box-shadow: 0 4px 12px #0004;
    font-size: 12px;
    line-height: 1.4;
    text-align: center;
    white-space: normal;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    scale: 0.9;
    transform: translateX(-50%);
    transform-origin: top center;
    transition:
      opacity 180ms ease-out,
      visibility 180ms ease-out,
      scale 180ms ease-out;
    transition-delay: 120ms;
  }
  .tooltip-anchor[data-align="start"] .tooltip-bubble {
    left: 0;
    transform: none;
    transform-origin: top left;
  }
  .tooltip-anchor[data-align="end"] .tooltip-bubble {
    left: auto;
    right: 0;
    transform: none;
    transform-origin: top right;
  }
  .tooltip-anchor[data-placement="top"] .tooltip-bubble {
    top: auto;
    bottom: calc(100% + 7px);
    transform-origin: bottom center;
  }
  .tooltip-anchor[data-placement="top"][data-align="start"] .tooltip-bubble {
    transform-origin: bottom left;
  }
  .tooltip-anchor[data-placement="top"][data-align="end"] .tooltip-bubble {
    transform-origin: bottom right;
  }
  .tooltip-anchor:is(:hover, :focus-within) {
    z-index: 31;
  }
  .tooltip-anchor:is(:hover, :focus-within) .tooltip-bubble {
    opacity: 1;
    visibility: visible;
    scale: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .tooltip-bubble {
      transition: none;
    }
  }
</style>
