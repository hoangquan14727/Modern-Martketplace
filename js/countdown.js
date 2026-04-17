/**
 * Shared countdown / time-slot utilities for Flash Sale.
 * Used by both homePage.html and flashSalePage.html.
 */

var FlashSaleTimer = (function () {
  'use strict';

  var TIME_SLOTS = [
    { hour: 0, label: '00:00' },
    { hour: 9, label: '09:00' },
    { hour: 12, label: '12:00' },
    { hour: 15, label: '15:00' },
    { hour: 18, label: '18:00' },
    { hour: 21, label: '21:00' }
  ];

  /** Return the index of the slot that is currently running. */
  function getCurrentSlotIndex() {
    var h = new Date().getHours();
    var idx = 0;
    for (var i = TIME_SLOTS.length - 1; i >= 0; i--) {
      if (h >= TIME_SLOTS[i].hour) { idx = i; break; }
    }
    return idx;
  }

  /** Get the Date when a slot ends (= start of next slot, or midnight+). */
  function getSlotEndTime(slotIdx) {
    var now = new Date();
    var nextIdx = slotIdx + 1;
    if (nextIdx < TIME_SLOTS.length) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), TIME_SLOTS[nextIdx].hour, 0, 0);
    }
    // Last slot ends at midnight (next day first slot)
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, TIME_SLOTS[0].hour, 0, 0);
  }

  /** Get the Date when a slot starts. */
  function getSlotStartTime(slotIdx) {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), TIME_SLOTS[slotIdx].hour, 0, 0);
  }

  /**
   * Determine the state of `activeSlot` relative to the clock.
   * @param {number} activeSlot
   * @returns {'past'|'current'|'upcoming'}
   */
  function getSlotState(activeSlot) {
    var currentIdx = getCurrentSlotIndex();
    if (activeSlot < currentIdx) return 'past';
    if (activeSlot === currentIdx) return 'current';
    return 'upcoming';
  }

  /**
   * Compute the countdown target and label for a given active slot.
   * @param {number} activeSlot
   * @returns {{ target: Date|null, label: string, state: string }}
   */
  function getCountdownTarget(activeSlot) {
    var state = getSlotState(activeSlot);
    if (state === 'current') {
      return { target: getSlotEndTime(activeSlot), label: 'Kết thúc sau', state: state };
    }
    if (state === 'upcoming') {
      return { target: getSlotStartTime(activeSlot), label: 'Bắt đầu sau', state: state };
    }
    // past
    return { target: null, label: 'Đã kết thúc', state: state };
  }

  /**
   * Format a countdown from now to a target Date.
   * @param {Date|null} target
   * @returns {{ h: string, m: string, s: string }}
   */
  function formatCountdown(target) {
    if (!target) return { h: '00', m: '00', s: '00' };
    var diff = Math.max(0, Math.floor((target - new Date()) / 1000));
    var h = Math.floor(diff / 3600);
    var m = Math.floor((diff % 3600) / 60);
    var s = diff % 60;
    return {
      h: String(h).padStart(2, '0'),
      m: String(m).padStart(2, '0'),
      s: String(s).padStart(2, '0')
    };
  }

  /**
   * Build a slot range label, e.g. "09:00 - 12:00".
   * @param {number} slotIdx
   * @returns {string}
   */
  function getSlotRangeLabel(slotIdx) {
    var start = TIME_SLOTS[slotIdx].label;
    var end = (slotIdx + 1 < TIME_SLOTS.length) ? TIME_SLOTS[slotIdx + 1].label : '00:00';
    return start + ' - ' + end;
  }

  /**
   * Seeded pseudo-random — same seed always returns the same value.
   * @param {number} seed
   * @param {number} min  inclusive
   * @param {number} max  exclusive
   * @returns {number}
   */
  function seededRandom(seed, min, max) {
    var hash = ((seed * 2654435761) >>> 0) / 4294967296;
    return Math.floor(min + hash * (max - min));
  }

  // Public API
  return {
    TIME_SLOTS: TIME_SLOTS,
    getCurrentSlotIndex: getCurrentSlotIndex,
    getSlotEndTime: getSlotEndTime,
    getSlotStartTime: getSlotStartTime,
    getSlotState: getSlotState,
    getCountdownTarget: getCountdownTarget,
    formatCountdown: formatCountdown,
    getSlotRangeLabel: getSlotRangeLabel,
    seededRandom: seededRandom
  };
})();
