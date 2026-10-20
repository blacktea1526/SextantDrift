# Spec Delta

## ADDED Requirements

### Requirement: Visible diagram matches the declared graph
The visible report diagram SHALL show each entity's full title and the same open-question text as the structured projection. It SHALL draw every declared relation. It MUST NOT add a module title, group name, or other label that the graph does not contain, and MUST NOT replace question text with a generic marker.

#### Scenario: Long title and open question stay intact
- **WHEN** an entity title is longer than sixteen characters and the entity carries an open question
- **THEN** the visible report diagram shows that full title and that question text
- **AND** the diagram does not replace the question with a generic label

#### Scenario: Cross-prefix relation stays visible
- **WHEN** the graph declares a relation between two entities whose ids use different letter prefixes
- **THEN** the visible diagram draws that relation
- **AND** the diagram does not display a module title absent from the graph

### Requirement: Review listing reports anchors only for code and tests
The review listing SHALL include a code neighbor's declared source path when that path exists. Only a code entity without a source path, or a test entity without a check id, SHALL be reported as a missing anchor. A requirement, flow, rule, event, or state neighbor SHALL be listed as review scope and MUST NOT be described as having a declared or missing anchor.

#### Scenario: Declared source path is printed
- **WHEN** a code neighbor declares a source path
- **THEN** the review listing includes that path
- **AND** the listing does not call that anchor missing

#### Scenario: Non-anchor neighbor makes no anchor claim
- **WHEN** a state entity shares a declared relation with the queried entity
- **THEN** the review listing includes that state as review scope
- **AND** the listing does not say an anchor is declared or missing

### Requirement: Shorthand lists belong to requirements
A shorthand list of related ids is valid only on a requirement entity. The same list on any other kind MUST fail validation as a configuration error that names the entity id. A requirement's shorthand list MUST still become relations.

#### Scenario: Shorthand on a flow fails
- **WHEN** a flow entity carries a rules list
- **THEN** validation fails and the error names that entity id
- **AND** the failure is not reported as an acceptance FAIL

#### Scenario: Requirement shorthand still expands
- **WHEN** a requirement lists a rule id in its rules
- **THEN** the normalized graph contains one relation between that requirement and that rule
