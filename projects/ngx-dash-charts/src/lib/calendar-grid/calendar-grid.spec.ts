import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DASH_CALENDAR_GRID_IMPORTS, injectCalendarGrid } from '.';
import { DashCalendarRange } from './calendar-grid.dates';

interface Room {
  id: string;
  name: string;
  booked: string[];
}

/** A different use than team availability: which meeting rooms are booked. */
@Component({
  imports: [DASH_CALENDAR_GRID_IMPORTS],
  template: `
    <dash-calendar-grid
      label="Room bookings"
      [rows]="rooms"
      [rowId]="id"
      [rowLabel]="name"
      today="2026-11-11"
      [(range)]="range"
      [(anchor)]="anchor"
      [(selectedDay)]="selected"
      [ranges]="[]"
    >
      <ng-template [dashDayCell]="rooms" let-room let-day="day">
        <span class="booking">{{ room.booked.includes(day) ? 'Booked' : 'Free' }}</span>
      </ng-template>
      <aside dashCalendarGridAside aria-label="Details">{{ selected() }}</aside>
    </dash-calendar-grid>
  `,
})
class RoomBookings {
  readonly rooms: Room[] = [
    { id: 'a', name: 'Aspen', booked: ['2026-11-10'] },
    { id: 'b', name: 'Birch', booked: [] },
  ];
  readonly id = (r: Room) => r.id;
  readonly name = (r: Room) => r.name;
  readonly range = signal<DashCalendarRange>('week');
  readonly anchor = signal('2026-11-11');
  readonly selected = signal('2026-11-11');
}

@Component({ selector: 'dash-stray-part', template: '' })
class StrayPart {
  readonly grid = injectCalendarGrid('dash-stray-part');
}

describe('CalendarGrid', () => {
  it('renders any kind of row with the caller’s cell template', async () => {
    const fixture = TestBed.createComponent(RoomBookings);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('h2')?.textContent).toContain('Mon 9 – Fri 13 Nov');
    expect(el.querySelector('mat-button-toggle-group')).toBeNull();
    expect(el.querySelector('.dash-calendar-grid__aside')?.getAttribute('tabindex')).toBe('0');
    // AG Grid draws rows on a later frame.
    const cells = await vi.waitFor(
      () => {
        const found = [...el.querySelectorAll('.booking')].map((c) => c.textContent);
        expect(found).toHaveLength(10);
        return found;
      },
      { timeout: 3000 },
    );
    expect(cells.filter((c) => c === 'Booked')).toHaveLength(1);
  });

  it('writes the period and selection back through two-way bindings', async () => {
    const fixture = TestBed.createComponent(RoomBookings);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    el.querySelector<HTMLButtonElement>('[aria-label="Next period"]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.anchor()).toBe('2026-11-18');
    // The selected day left the view, and today isn't in it either, so the first day is picked.
    expect(fixture.componentInstance.selected()).toBe('2026-11-16');
  });

  it('explains a part used outside the grid', () => {
    expect(() => TestBed.createComponent(StrayPart)).toThrow(/inside <dash-calendar-grid>/);
  });
});
