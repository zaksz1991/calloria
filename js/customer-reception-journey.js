/**
 * Deterministic walk-in customer journey controller for CALLORIA's existing
 * reception scene. This module has no Three.js dependency and is unit-testable.
 */

export const CUSTOMER_JOURNEY_STATES = Object.freeze({
  WAITING: 'waiting',
  APPROACHING: 'approaching',
  SERVING: 'serving',
  SUPERVISOR_WAIT: 'supervisor_wait',
  SUPERVISOR_ASSIST: 'supervisor_assist',
  DEPARTING: 'departing',
  GONE: 'gone'
});

const QUEUE_POSITIONS = Object.freeze([
  { x: -16.85, y: 0, z: 15.0, yaw: 0 },
  { x: -13.15, y: 0, z: 15.0, yaw: 0 }
]);

const SERVICE_POSITIONS = Object.freeze([
  { x: -15.8, y: 0, z: 13.72, yaw: 0 },
  { x: -14.2, y: 0, z: 13.72, yaw: 0 }
]);

const EXIT_WAYPOINTS = Object.freeze([
  { x: -10.1, y: 0, z: 14.85 },
  { x: -5.2, y: 0, z: 15.25 },
  { x: -1.1, y: 0, z: 16.15 },
  { x: 0, y: 0, z: 17.2 }
]);

const ACTIVE_STATES = new Set([
  CUSTOMER_JOURNEY_STATES.APPROACHING,
  CUSTOMER_JOURNEY_STATES.SERVING,
  CUSTOMER_JOURNEY_STATES.SUPERVISOR_WAIT,
  CUSTOMER_JOURNEY_STATES.SUPERVISOR_ASSIST,
  CUSTOMER_JOURNEY_STATES.DEPARTING
]);

function safeScenarioId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function setWrapperPosition(wrapper, position) {
  if (!wrapper?.position || !position) return;
  wrapper.position.set(position.x, position.y ?? 0, position.z);
}

function clonePoint(point) {
  return { x: Number(point.x) || 0, y: Number(point.y) || 0, z: Number(point.z) || 0 };
}

export class CustomerReceptionJourney {
  constructor(visitors = [], { onStateChange = () => {}, onEscalation = () => {} } = {}) {
    this.visitors = Array.isArray(visitors) ? visitors : [];
    this.onStateChange = onStateChange;
    this.onEscalation = onEscalation;
    this.pending = [];
    this.disposed = false;

    this.visitors.forEach((visitor, index) => {
      const queue = QUEUE_POSITIONS[index % QUEUE_POSITIONS.length];
      visitor.queuePosition = { ...queue };
      visitor.servicePosition = { ...SERVICE_POSITIONS[index % SERVICE_POSITIONS.length] };
      visitor.scenarioId = null;
      visitor.state = CUSTOMER_JOURNEY_STATES.WAITING;
      visitor.movement = null;
      visitor.wrapper.visible = true;
      visitor.wrapper.rotation.y = queue.yaw;
      setWrapperPosition(visitor.wrapper, queue);
      this.#notify(visitor, 'customer entered reception queue');
    });
  }

  #notify(visitor, reason) {
    this.onStateChange({
      assetId: visitor.assetId,
      scenarioId: visitor.scenarioId,
      state: visitor.state,
      emotion: visitor.emotion || 'calm',
      reaction: visitor.reaction || 'steady',
      reason
    }, visitor);
  }

  #setState(visitor, state, reason) {
    visitor.state = state;
    this.#notify(visitor, reason);
  }

  #findScenario(scenarioId) {
    return this.visitors.find((visitor) => visitor.scenarioId === scenarioId) || null;
  }

  #freeVisitor() {
    return this.visitors.find((visitor) =>
      visitor.state === CUSTOMER_JOURNEY_STATES.WAITING || visitor.state === CUSTOMER_JOURNEY_STATES.GONE
    ) || null;
  }

  #beginPath(visitor, points, finalState, speed = 1.25) {
    const cleanPoints = points.map(clonePoint);
    if (!cleanPoints.length) {
      this.#setState(visitor, finalState, 'journey transition completed');
      return;
    }
    visitor.movement = {
      points: cleanPoints,
      index: 0,
      speed,
      finalState
    };
  }

  #startServing(visitor, record) {
    visitor.scenarioId = record.scenarioId;
    visitor.emotion = record.emotion || 'calm';
    visitor.reaction = record.reaction || 'steady';
    visitor.patience = record.patience ?? null;
    visitor.turn = Number(record.turn) || 0;
    visitor.wrapper.visible = true;
    const target = visitor.servicePosition;
    this.#setState(visitor, CUSTOMER_JOURNEY_STATES.APPROACHING, 'customer called forward from the queue');
    this.#beginPath(visitor, [target], CUSTOMER_JOURNEY_STATES.SERVING, 1.15);
  }

  #assignPending() {
    if (this.disposed) return;
    while (this.pending.length) {
      const visitor = this.#freeVisitor();
      if (!visitor) return;
      const record = this.pending.shift();
      if (!record || this.#findScenario(record.scenarioId)) continue;
      if (visitor.state === CUSTOMER_JOURNEY_STATES.GONE) {
        visitor.wrapper.visible = true;
        setWrapperPosition(visitor.wrapper, visitor.queuePosition);
        visitor.wrapper.rotation.y = visitor.queuePosition.yaw;
      }
      this.#startServing(visitor, record);
    }
  }

  #startDeparture(visitor, reason) {
    if (visitor.state === CUSTOMER_JOURNEY_STATES.DEPARTING || visitor.state === CUSTOMER_JOURNEY_STATES.GONE) return;
    this.#setState(visitor, CUSTOMER_JOURNEY_STATES.DEPARTING, reason);
    this.#beginPath(visitor, EXIT_WAYPOINTS, CUSTOMER_JOURNEY_STATES.GONE, 1.45);
  }

  handleReaction(detail = {}) {
    if (this.disposed) return;
    const scenarioId = safeScenarioId(detail.scenarioId);
    if (!scenarioId) return;
    const status = String(detail.status || 'active').toLowerCase();
    const emotion = String(detail.emotion || 'calm').toLowerCase();
    const reaction = String(detail.reaction || 'steady').toLowerCase();
    const turn = Number(detail.turn) || 0;
    let visitor = this.#findScenario(scenarioId);

    if (!visitor && status === 'active') {
      const queued = this.pending.find((item) => item.scenarioId === scenarioId);
      if (queued) {
        Object.assign(queued, { emotion, reaction, patience: detail.patience, turn });
      } else {
        this.pending.push({ scenarioId, emotion, reaction, patience: detail.patience, turn });
      }
      this.#assignPending();
      visitor = this.#findScenario(scenarioId);
    }

    if (!visitor) return;

    visitor.emotion = status === 'escalated' ? 'angry' : (status === 'completed' && reaction === 'improving' ? 'happy' : emotion);
    visitor.reaction = status === 'escalated' ? 'deteriorating' : reaction;
    visitor.patience = detail.patience ?? visitor.patience;
    visitor.turn = turn;
    this.#notify(visitor, `customer reaction: ${status}`);

    if (status === 'escalated') {
      visitor.movement = null;
      visitor.wrapper.rotation.y = Math.PI / 2;
      this.#setState(visitor, CUSTOMER_JOURNEY_STATES.SUPERVISOR_WAIT, 'supervisor intervention requested');
      this.onEscalation({
        scenarioId,
        assetId: visitor.assetId,
        emotion: visitor.emotion,
        turn,
        patience: visitor.patience
      }, visitor);
      return;
    }

    if (status === 'completed') {
      this.#startDeparture(visitor, 'interaction completed; customer exits the reception');
      return;
    }

    if (visitor.state === CUSTOMER_JOURNEY_STATES.SUPERVISOR_WAIT || visitor.state === CUSTOMER_JOURNEY_STATES.SUPERVISOR_ASSIST) {
      return;
    }
    if (visitor.state === CUSTOMER_JOURNEY_STATES.WAITING) {
      this.#setState(visitor, CUSTOMER_JOURNEY_STATES.SERVING, 'interaction resumed');
    }
  }

  handleCommand(detail = {}) {
    if (this.disposed) return;
    const scenarioId = safeScenarioId(detail.scenarioId);
    const visitor = scenarioId ? this.#findScenario(scenarioId) : null;
    if (!visitor) return;
    const action = String(detail.action || '').toLowerCase();

    if (action === 'supervisor-arrived' && visitor.state === CUSTOMER_JOURNEY_STATES.SUPERVISOR_WAIT) {
      visitor.wrapper.rotation.y = Math.PI / 2;
      this.#setState(visitor, CUSTOMER_JOURNEY_STATES.SUPERVISOR_ASSIST, 'supervisor has joined the customer interaction');
    } else if (action === 'supervisor-resolved' || action === 'customer-released' || action === 'depart') {
      this.#startDeparture(visitor, 'supervisor disposition recorded; customer exits');
    } else if (action === 'resume' && visitor.state === CUSTOMER_JOURNEY_STATES.SUPERVISOR_ASSIST) {
      this.#setState(visitor, CUSTOMER_JOURNEY_STATES.SERVING, 'supervisor returned interaction to agent');
    }
  }

  update(delta) {
    if (this.disposed) return;
    const step = Math.max(0, Math.min(Number(delta) || 0, 0.05));
    if (!step) return;

    for (const visitor of this.visitors) {
      const movement = visitor.movement;
      if (!movement) continue;
      const target = movement.points[movement.index];
      if (!target) {
        visitor.movement = null;
        this.#setState(visitor, movement.finalState, 'customer movement completed');
        continue;
      }
      const position = visitor.wrapper.position;
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      const distance = Math.hypot(dx, dz);
      const travel = movement.speed * step;
      if (distance <= travel || distance < 0.0001) {
        position.set(target.x, target.y, target.z);
        movement.index += 1;
        if (movement.index >= movement.points.length) {
          visitor.movement = null;
          const finalState = movement.finalState;
          if (finalState === CUSTOMER_JOURNEY_STATES.GONE) {
            visitor.wrapper.visible = false;
            this.#setState(visitor, CUSTOMER_JOURNEY_STATES.GONE, 'customer has left the workplace');
            visitor.scenarioId = null;
            this.#assignPending();
          } else {
            this.#setState(visitor, finalState, 'customer reached the service counter');
          }
        }
      } else {
        position.x += (dx / distance) * travel;
        position.z += (dz / distance) * travel;
        visitor.wrapper.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  get snapshot() {
    return this.visitors.map((visitor) => ({
      assetId: visitor.assetId,
      scenarioId: visitor.scenarioId,
      state: visitor.state,
      emotion: visitor.emotion || 'calm',
      visible: Boolean(visitor.wrapper.visible)
    }));
  }

  dispose() {
    this.disposed = true;
    this.pending.length = 0;
    for (const visitor of this.visitors) visitor.movement = null;
  }
}
