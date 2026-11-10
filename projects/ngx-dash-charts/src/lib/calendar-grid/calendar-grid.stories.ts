import { ChangeDetectionStrategy, Component, input, linkedSignal, signal } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { DASH_CALENDAR_GRID_IMPORTS, DashCalendarRange, DashDayKey } from '.';

interface Room {
  id: string;
  name: string;
  floor: string;
  seats: number;
  /** Day keys with a booking. */
  booked: readonly DashDayKey[];
}

const TODAY = '2026-11-11';

/** Deterministic bookings: each room is busy on a different rhythm through November 2026. */
const ROOMS: Room[] = [
  { id: 'aspen', name: 'Aspen', floor: 'Floor 1', seats: 4, every: 2 },
  { id: 'birch', name: 'Birch', floor: 'Floor 1', seats: 8, every: 3 },
  { id: 'cedar', name: 'Cedar', floor: 'Floor 2', seats: 12, every: 4 },
  { id: 'dogwood', name: 'Dogwood', floor: 'Floor 2', seats: 6, every: 5 },
  { id: 'elm', name: 'Elm', floor: 'Floor 3', seats: 20, every: 7 },
].map(({ every, ...room }, offset) => ({
  ...room,
  booked: Array.from({ length: 30 }, (_, i) => i + 1)
    .filter((d) => (d + offset) % every === 0)
    .map((d) => `2026-11-${String(d).padStart(2, '0')}`),
}));

@Component({
  selector: 'dash-room-bookings-demo',
  imports: [DASH_CALENDAR_GRID_IMPORTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dash-calendar-grid
      label="Room bookings"
      rowHeaderLabel="Room"
      totalLabel="Booked"
      summaryLabel="Rooms free"
      [rows]="rooms"
      [rowId]="id"
      [rowLabel]="name"
      [groupBy]="grouped() ? floor : null"
      [total]="bookedDays"
      [today]="today"
      [weekends]="weekends()"
      [(range)]="range"
      [(anchor)]="anchor"
      [(selectedDay)]="selected"
      (cellActivated)="last.set($event.row.name + ' on ' + $event.day)"
    >
      <ng-template [dashDayCell]="rooms" let-room let-day="day" let-wide="wide">
        @let busy = room.booked.includes(day);
        <span class="demo-booking" [class.is-busy]="busy" [attr.aria-label]="busy ? 'Booked' : 'Free'">
          {{ wide ? (busy ? 'Booked' : 'Free') : '' }}
        </span>
      </ng-template>

      <ng-template [dashRowHeader]="rooms" let-room>
        <span><strong>{{ room.name }}</strong> · {{ room.seats }} seats</span>
      </ng-template>

      <ng-template dashSummaryCell let-day>{{ freeOn(day) }}</ng-template>

      <p dashCalendarGridFooter class="demo-note">Click a day to select it. Sort by room or by days booked.</p>

      @if (aside()) {
        <aside dashCalendarGridAside aria-label="Selected day">
          <h3 style="margin: 0 0 8px">{{ selected() }}</h3>
          <p>{{ freeOn(selected()) }} of {{ rooms.length }} rooms free.</p>
          <p>Last activated: {{ last() || '—' }}</p>
        </aside>
      }
    </dash-calendar-grid>
  `,
  styles: `
    .demo-booking {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border-radius: 4px;
      background: color-mix(in srgb, var(--dash-series-3, #1baf7a) 18%, transparent);
      font-size: 0.75rem;
    }
    .demo-booking.is-busy {
      background: color-mix(in srgb, var(--dash-series-2, #eb6834) 30%, transparent);
    }
    .demo-note {
      margin: 0;
      color: var(--dash-muted, #7d8893);
      font-size: 0.8125rem;
    }
  `,
})
class RoomBookingsDemo {
  readonly grouped = input(true);
  readonly weekends = input(false);
  readonly aside = input(true);
  readonly initialRange = input<DashCalendarRange>('week');

  protected readonly rooms = ROOMS;
  protected readonly today = TODAY;
  protected readonly range = linkedSignal(() => this.initialRange());
  protected readonly anchor = signal(TODAY);
  protected readonly selected = signal(TODAY);
  protected readonly last = signal('');
  protected readonly id = (r: Room) => r.id;
  protected readonly name = (r: Room) => r.name;
  protected readonly floor = (r: Room) => r.floor;
  protected readonly bookedDays = (r: Room) => r.booked.length;
  protected freeOn(day: DashDayKey): number {
    return this.rooms.filter((r) => !r.booked.includes(day)).length;
  }
}

type Args = { grouped: boolean; weekends: boolean; aside: boolean; range: DashCalendarRange };

const meta: Meta<Args> = {
  title: 'Building blocks/Calendar grid',
  parameters: {
    docs: {
      description: {
        component:
          'Rows against days, with previous / next / Today and a period switch, on AG Grid. ' +
          'It knows nothing about the rows: you choose what each cell shows with `ng-template`s, and ' +
          'optional regions (summary row, total column, groups, toolbar tools, footer, side panel) ' +
          'appear only when you provide them.',
      },
    },
  },
  argTypes: {
    range: { control: 'inline-radio', options: ['week', 'fortnight', 'month'] },
  },
  args: { grouped: true, weekends: false, aside: true, range: 'week' },
  decorators: [moduleMetadata({ imports: [RoomBookingsDemo] })],
  render: (args) => ({
    props: args,
    template: `<dash-room-bookings-demo [grouped]="grouped" [weekends]="weekends" [aside]="aside" [initialRange]="range" />`,
  }),
};
export default meta;

type Story = StoryObj<Args>;

export const RoomBookings: Story = {};
export const Month: Story = { args: { range: 'month', aside: false } };
export const WithWeekends: Story = { args: { weekends: true, grouped: false } };
