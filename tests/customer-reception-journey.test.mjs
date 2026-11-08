import test from 'node:test';
import assert from 'node:assert/strict';
import { CustomerReceptionJourney, CUSTOMER_JOURNEY_STATES as S } from '../js/customer-reception-journey.js';

function makeVisitor(assetId) {
  return {
    assetId,
    wrapper: {
      visible: true,
      rotation: { y: 0 },
      position: {
        x: 0, y: 0, z: 0,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; }
      }
    }
  };
}

function advance(journey, seconds, step = 0.05) {
  const count = Math.ceil(seconds / step);
  for (let index = 0; index < count; index += 1) journey.update(Math.min(step, seconds - index * step));
}

test('visitors start in the reception queue, not embedded in the counter', () => {
  const visitors = [makeVisitor('robbert-visitor')];
  const journey = new CustomerReceptionJourney(visitors);
  assert.equal(visitors[0].state, S.WAITING);
  assert.equal(visitors[0].wrapper.visible, true);
  assert.equal(visitors[0].wrapper.position.z, 15);
  journey.dispose();
});

test('a new interaction calls one queued customer forward to the counter', () => {
  const visitor = makeVisitor('robbert-visitor');
  const journey = new CustomerReceptionJourney([visitor]);
  journey.handleReaction({ scenarioId: 'CIL-1', status: 'active', turn: 0, emotion: 'angry' });
  assert.equal(visitor.scenarioId, 'CIL-1');
  assert.equal(visitor.state, S.APPROACHING);
  advance(journey, 4);
  assert.equal(visitor.state, S.SERVING);
  assert.equal(visitor.wrapper.position.z, 13.72);
});

test('reaction updates apply to the customer assigned to that scenario', () => {
  const visitor = makeVisitor('robbert-visitor');
  const journey = new CustomerReceptionJourney([visitor]);
  journey.handleReaction({ scenarioId: 'CIL-2', status: 'active', turn: 0, emotion: 'confused' });
  journey.handleReaction({ scenarioId: 'CIL-2', status: 'active', turn: 1, emotion: 'happy', reaction: 'improving' });
  assert.equal(visitor.emotion, 'happy');
  assert.equal(visitor.reaction, 'improving');
});

test('an escalated interaction pauses for supervisor intervention and emits a request', () => {
  const visitor = makeVisitor('ribbert-customer');
  const escalations = [];
  const journey = new CustomerReceptionJourney([visitor], { onEscalation: (event) => escalations.push(event) });
  journey.handleReaction({ scenarioId: 'CIL-3', status: 'active', turn: 0 });
  journey.handleReaction({ scenarioId: 'CIL-3', status: 'escalated', turn: 1, emotion: 'angry' });
  assert.equal(visitor.state, S.SUPERVISOR_WAIT);
  assert.equal(escalations.length, 1);
  assert.equal(escalations[0].scenarioId, 'CIL-3');
});

test('supervisor arrival and release produce assistance and departure states', () => {
  const visitor = makeVisitor('ribbert-customer');
  const journey = new CustomerReceptionJourney([visitor]);
  journey.handleReaction({ scenarioId: 'CIL-4', status: 'active', turn: 0 });
  journey.handleReaction({ scenarioId: 'CIL-4', status: 'escalated', turn: 1 });
  journey.handleCommand({ scenarioId: 'CIL-4', action: 'supervisor-arrived' });
  assert.equal(visitor.state, S.SUPERVISOR_ASSIST);
  journey.handleCommand({ scenarioId: 'CIL-4', action: 'supervisor-resolved' });
  assert.equal(visitor.state, S.DEPARTING);
});

test('completed interaction makes the customer walk out and disappear', () => {
  const visitor = makeVisitor('robbert-visitor');
  const journey = new CustomerReceptionJourney([visitor]);
  journey.handleReaction({ scenarioId: 'CIL-5', status: 'active', turn: 0 });
  advance(journey, 4);
  journey.handleReaction({ scenarioId: 'CIL-5', status: 'completed', turn: 3, emotion: 'happy', reaction: 'improving' });
  assert.equal(visitor.state, S.DEPARTING);
  advance(journey, 20);
  assert.equal(visitor.state, S.GONE);
  assert.equal(visitor.wrapper.visible, false);
  assert.equal(visitor.scenarioId, null);
});

test('new customers are queued until a visitor slot becomes free', () => {
  const visitor = makeVisitor('robbert-visitor');
  const journey = new CustomerReceptionJourney([visitor]);
  journey.handleReaction({ scenarioId: 'CIL-6A', status: 'active', turn: 0 });
  journey.handleReaction({ scenarioId: 'CIL-6B', status: 'active', turn: 0 });
  assert.equal(visitor.scenarioId, 'CIL-6A');
  assert.equal(journey.pending.length, 1);
  advance(journey, 4);
  journey.handleReaction({ scenarioId: 'CIL-6A', status: 'completed', turn: 3, reaction: 'improving' });
  advance(journey, 20);
  assert.equal(visitor.scenarioId, 'CIL-6B');
  assert.equal(visitor.state, S.SERVING);
  assert.equal(visitor.wrapper.visible, true);
});

test('unknown supervisor commands do not mutate unrelated visitors', () => {
  const visitor = makeVisitor('robbert-visitor');
  const journey = new CustomerReceptionJourney([visitor]);
  journey.handleCommand({ scenarioId: 'CIL-NOT-FOUND', action: 'supervisor-arrived' });
  assert.equal(visitor.state, S.WAITING);
});
