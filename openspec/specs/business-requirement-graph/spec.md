# business-requirement-graph Specification

## Purpose

Gives humans and agents one business-requirement graph, so a diagram and a structured record name the same entities, and a change lists only the directly linked items to review.

## Requirements

### Requirement: Absent graph preserves existing gates
When configuration omits the business requirement graph, architecture check, baseline, and acceptance evaluation MUST keep their current results and exit semantics.

#### Scenario: Configuration without the graph
- **WHEN** a project configuration omits the business requirement graph
- **THEN** architecture check and acceptance evaluation return the same outcomes they return for that configuration today

### Requirement: One writable model
The system SHALL accept one schema-validated graph as the only writable source for requirements, flows, rules, events, states, tests, and code anchors. A diagram MUST be a projection of that graph and MUST NOT be accepted as a second stored source.

#### Scenario: Redeem membership uses one set of ids
- **WHEN** the graph contains BR-001 linked to FLOW-001, RULE-003, EVENT-002, STATE-001, TC-003, and CODE-004
- **THEN** the structured projection and the diagram projection both name exactly those ids

### Requirement: Entity identity matches its kind
Each entity MUST have one unique id. The id prefix MUST match the entity kind: BR, FLOW, RULE, EVENT, STATE, TC, or CODE.

#### Scenario: Prefix does not match kind
- **WHEN** a rule entity uses an id that does not start with RULE-
- **THEN** validation fails and the error names that id

### Requirement: Relations name existing entities
A relation MUST name two existing entity ids and one relation type. Reference lists on a requirement MUST become relations. A relation to a missing id, or two different relation types between the same pair, MUST fail validation.

#### Scenario: Rule list becomes one relation
- **WHEN** BR-001 lists RULE-003 among its rules
- **THEN** the normalized graph contains one relation between BR-001 and RULE-003

#### Scenario: Dangling relation fails
- **WHEN** a relation names an id that is not an entity
- **THEN** validation fails and the error names the missing id

### Requirement: Impact is the direct declared neighborhood
For an entity id, the system SHALL return each entity that shares a declared relation with it, and SHALL mark every item as review scope. The result MUST NOT include an entity reached only through a longer path, and MUST NOT state that source code was analyzed.

#### Scenario: Rule change lists its three neighbors
- **WHEN** RULE-003 affects STATE-001, is implemented by CODE-004, and is verified by TC-003
- **THEN** the impact of RULE-003 contains exactly STATE-001, CODE-004, and TC-003, each labeled review scope

#### Scenario: Unrelated flow stays out
- **WHEN** BR-001 includes both RULE-003 and FLOW-001, and FLOW-001 has no relation to RULE-003
- **THEN** the impact of RULE-003 does not contain FLOW-001

### Requirement: Missing anchors remain gaps
When a related code entity has no declared source location, or a related test entity has no declared check, impact SHALL still list that entity as review scope and SHALL say the anchor is missing. The system MUST NOT search the repository or test results to invent the anchor.

#### Scenario: Code entity has no path
- **WHEN** CODE-004 is related to RULE-003 and CODE-004 declares no source path
- **THEN** impact lists CODE-004 as review scope with a missing source anchor
- **AND** the result names no file that the graph did not declare

### Requirement: Test links do not evaluate acceptance
A test entity MAY name an acceptance check id. If acceptance configuration is present and that id is unknown, loading the graph MUST fail as a configuration error. The impact listing MUST NOT assign PASS, FAIL, UNVERIFIED, or ERROR to the check.

#### Scenario: Unknown check id is a configuration error
- **WHEN** TC-003 names a check id that the present acceptance configuration does not contain
- **THEN** loading the graph fails as a configuration error
- **AND** that failure is not reported as an acceptance FAIL

#### Scenario: Known check id stays unevaluated
- **WHEN** TC-003 names a check id that acceptance configuration contains
- **THEN** impact lists TC-003 as review scope
- **AND** the listing does not assign PASS or FAIL to that check

### Requirement: Questions belong to entities
An entity MAY carry question text. The structured projection and the diagram projection SHALL show the same question text for that entity.

#### Scenario: Open question appears in both projections
- **WHEN** RULE-003 carries an open question
- **THEN** the structured projection and the diagram projection both include that question text

### Requirement: Projections are deterministic
Two loads of the same graph content MUST produce byte-identical structured projections and byte-identical diagram text, regardless of input object key order.

#### Scenario: Key order does not change output
- **WHEN** the same entities and relations are supplied with a different object key order
- **THEN** both the structured projection and the diagram text are byte-identical
