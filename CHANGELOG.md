# Changelog

## [3.6.0](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.5.4...v3.6.0) (2026-11-24)


### Features

* client configuration and remote control over /ws/client ([#185](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/185)) ([e3718fc](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/e3718fc8b124ac39c4c19cdc59c53b59165ea20a))
* clock and tier-3 harness with the first synthetic fixture ([#151](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/151)) ([#175](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/175)) ([61c5f5c](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/61c5f5cf52de200481afc4310d2ad54100db0159))
* entity store with hydration and per-field deltas ([#156](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/156)) ([#173](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/173)) ([e418bf6](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/e418bf6c3e4edb00e512a71e39ec27d1e5a95c7d))
* live switch, the board runs on the new server ([#165](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/165)) ([#187](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/187)) ([a81c3b6](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/a81c3b689159cf8275147779ed831d232daf7bb3))
* real-race check of the board against a replaying server ([#188](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/188)) ([512659e](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/512659e32a3778f3d8609447f7a4ea0ac972c90b))
* route the remaining timing sites through the Clock ([#163](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/163)) ([#183](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/183)) ([496b6f3](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/496b6f3b447f1fa11e2c7e8f95cabe00a66985e5))
* store applies removals, scope replace and event change ([#159](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/159)) ([#178](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/178)) ([91bc8fd](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/91bc8fd937d1b21acc7ed56491c31db9f66bc71b))
* transport with REST hydration, /ws handshake and liveness ([#160](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/160)) ([#179](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/179)) ([6f3c13d](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/6f3c13d45401a94c7f75dee707125f54d4f131a8))
* view-model on-course row and display lifetimes under the Clock ([#162](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/162)) ([#181](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/181)) ([66bb27a](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/66bb27aaaf5593b84e8b4d769ae6097b3c7089d6))
* view-model results, Phase choice and labels ([#161](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/161)) ([#180](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/180)) ([cb79bd5](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/cb79bd51a7a220483f8d971fc20520c663c6e4ba))
* walking skeleton, a fixture rendered through store and BoardView ([#158](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/158)) ([#177](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/177)) ([8f863fc](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/8f863fcaa2758beee682975a154abbc7f65e0f5c))


### Bug Fixes

* featured row skips the start queue and honours ?category= ([#182](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/182)) ([#184](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/184)) ([c91cb54](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/c91cb5478918b19357ce61967d7b464cbd6f8e43))
* on an asOf tie the Phase choice shows the later Phase ([#190](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/190)) ([525f44f](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/525f44f1a57af6f703a85fd4df6b0dbe722fc676))
* scale the scaled ledwall layout from its measured height ([#186](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/186)) ([06ab7e4](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/06ab7e4ba31c41d82e0724c0f2045cd07a42158f))

## [3.5.4](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.5.3...v3.5.4) (2026-09-24)


### Bug Fixes

* fetch relative recording paths in ReplayProvider ([#133](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/133)) ([e211616](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/e211616671028477cbc0162cb5cf4f0eacd7fb57)), closes [#132](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/132)

## [3.5.3](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.5.2...v3.5.3) (2026-09-20)


### Bug Fixes

* scroll only the results list when highlighting a finished competitor ([#129](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/129)) ([808aa44](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/808aa4405192d0d4b105d71bb1c17089092301ff)), closes [#128](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/128)

## [3.5.2](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.5.1...v3.5.2) (2026-06-07)


### Bug Fixes

* align react and react-dom to 19.2.7 (error [#527](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/527)) ([#91](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/91)) ([eca99ef](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/eca99efe5e93c1b4380a27fb4b62bce84a8af47f))

## [3.5.1](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.5.0...v3.5.1) (2026-06-07)


### Continuous Integration

* attach built dist bundle as asset to GitHub releases ([#88](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/88)) ([ada76d4](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/ada76d49b43cd0903a1cf567583b2e28232c155e)), closes [#87](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/87)

## [3.5.0](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.4.2...v3.5.0) (2026-04-29)


### Features

* allow to pre-select and fix category by URL parameter ([#49](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/49)) ([94a3578](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/94a357874a74057488afc6c8c859402d8d2ed236))

## [3.4.2](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.4.1...v3.4.2) (2026-04-29)


### Bug Fixes

* reset lastTopShownAt after scrollToTop in highlight-end ([#56](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/56)) ([ddd67fe](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/ddd67fe46d29fdb10fa33a50eed468c732b92a6c)), closes [#55](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/55)

## [3.4.1](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.4.0...v3.4.1) (2026-04-22)


### Bug Fixes

* pin finisher to CurrentCompetitor for 8s (interval racing) ([#58](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/58)) ([423147c](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/423147ce986857b7c6f5319955c38a2b6721ceaa)), closes [#57](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/57)

## [3.4.0](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.3.1...v3.4.0) (2026-04-21)


### Features

* add browse scroll after highlight on ledwall ([#53](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/53)) ([bc00a73](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/bc00a73303b652eec89717b7aa27b54c9af4c0cd))

## [3.3.1](https://github.com/OpenCanoeTiming/c123-scoreboard/compare/v3.3.0...v3.3.1) (2026-04-21)


### Bug Fixes

* remove stale competitors to unblock category switching ([#51](https://github.com/OpenCanoeTiming/c123-scoreboard/issues/51)) ([5e5f2c8](https://github.com/OpenCanoeTiming/c123-scoreboard/commit/5e5f2c83baff6fca5ef61d90372b2706c587a9ea))
