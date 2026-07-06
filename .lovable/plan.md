
# 전도팀 방문체크 앱 빌드 계획

## 1. 백엔드 (Lovable Cloud)

**테이블 (schema)**
- `maps`: id, code(text unique, 4자리), name, image_path(storage), total_houses(int), created_at
- `pins`: id, map_id(FK), x_pct(float), y_pct(float), status(enum: done|gift|refuse|away|skip), team_name(text), created_at
- `support_requests`: id, map_id(FK), team_name, created_at, resolved(bool)
- `app_settings`: 단일 행 `admin_link_token`(랜덤 문자열) — /admin/{token} 접근용

**Storage 버킷**: `map-images` (public read)

**RLS 정책 (핵심)**: 
- 개인정보 없음 + 코드가 곧 접근권한이므로 anon 전면 허용(SELECT/INSERT/DELETE). 단 `app_settings`는 anon 접근 차단.
- 서버 함수(`createServerFn`)로 코드 검증 후 map_id 반환 — 클라이언트에는 code 목록 노출 안 함.

**Realtime**: `pins`, `support_requests` 테이블에 replication 활성화.

## 2. 화면 구성 (라우트)

- `/` — 코드 입장 (지도 코드 4자리 + 조 이름) + 하단 "팀장 화면" 링크
- `/map/$code` — 지도 체크 화면 (localStorage에 조 이름 보관)
- `/leader` — 팀장 대시보드 (모든 지도 진행률/지원요청, 링크만으로 접근)
- `/admin/$token` — 관리자 화면 (지도 CRUD, 이미지 업로드, 가구수, 코드 발급, 핀 초기화)

## 3. 지도 체크 화면 (핵심)

- **줌/팬**: `react-zoom-pan-pinch` 라이브러리 — 핀치줌 + `+`/`−`/`1:1` 버튼 + 배율 배지
- **핀 렌더**: 지도 이미지 위에 절대좌표(x_pct/y_pct)로 SVG 물방울 마커 (테두리 없이 상태색 fill, 지도와 함께 스케일)
- **탭 동작**: 
  - 빈 위치 탭 → 하단 시트(5가지 상태 큰 버튼) → 선택 즉시 저장
  - 기존 핀 탭 → 정보창(상태·조·시각 + 삭제 버튼 + 안내 문구)
- **Undo**: 저장 직후 sonner 토스트 5초 노출, "되돌리기" 시 즉시 삭제
- **진행률**: `(전체 핀 수) / (total_houses − skip 수)` 상단 진행바
- **하단 버튼**: 지원요청 / 가구수 수정 / 다른 지도로

## 4. 팀장 대시보드

- 모든 지도 카드 리스트: 이름, 진행률(색상 진행바: ≥70% 녹/35–70 황/그이하 적), 처리/예상 가구수, skip 수
- 미해결 지원요청 배지 (조·시각 + "해결됨" 버튼)
- Realtime 구독으로 자동 갱신

## 5. 저장 안정성 & 오프라인

- **낙관적 UI**: 탭 즉시 로컬 상태에 핀 추가 → 서버 저장 → 실패 시 재시도(최대 3회) → 최종 실패 시 sonner 에러 토스트
- **오프라인 큐** (핀 생성/삭제만):
  - `navigator.onLine` false 또는 fetch 실패 시 IndexedDB(`idb-keyval`) 큐에 저장
  - `online` 이벤트 + 주기적 flush로 자동 동기화
  - 상단에 "저장 대기 중 N건" 뱃지 표시
- **재로드 정합성**: 화면 진입 시 서버에서 pins 재fetch (TanStack Query)

## 6. 실시간 동기화

- `/map/$code` 및 `/leader`에서 Supabase Realtime 구독 (pins INSERT/DELETE, support_requests INSERT/UPDATE)
- 이벤트 수신 시 TanStack Query 캐시 무효화

## 7. 디자인 톤

- **배경**: 오프화이트 크림 `#FBF7EF`, 카드 `#FFFFFF`
- **포인트**: 앰버/황토 `#C98A2E` (primary), 텍스트 `#2A2621`
- **상태색**: 스펙 그대로 (녹 #2F8F5B / 황 #E29B3E / 적 #B3434F / 남회 #566274 / 회 #A6A6A6)
- **폰트**: Pretendard (한글 가독성, 50–60대 고려) — @fontsource/pretendard, 본문 기본 16px, 큰 버튼 18–20px, 넉넉한 터치 타깃(최소 48px)
- 장식 최소, 명확한 대비, 큰 버튼

## 8. 기술 스택 세부

- TanStack Start + TanStack Query + Supabase (Lovable Cloud)
- 서버함수: `verifyCode(code)`, `verifyAdminToken(token)` — 화이트리스트 방식
- 라이브러리: `react-zoom-pan-pinch`, `idb-keyval`, `@fontsource/pretendard`
- shadcn: Sheet(상태선택), Dialog(삭제확인), Sonner(토스트/undo), Progress, Card, Input, Button

## 9. 시드 데이터

관리자 링크 토큰 1개 생성 + 예시 지도 1개(placeholder 이미지, code `1234`, total_houses 30)를 마이그레이션에 포함.

## 10. 개인정보 원칙

이름·사진·메모·연락처 필드 절대 없음. `team_name`은 "1팀 A조" 형식만 입력 유도(placeholder), 저장 외 다른 곳에는 노출 최소화.

---

**빌드 순서**
1. Lovable Cloud 활성화 + 마이그레이션(테이블/RLS/Realtime/스토리지) + 시드
2. 디자인 토큰(styles.css) 및 폰트 설치
3. 코드 입장(/) + 검증 서버함수
4. 지도 체크(/map/$code): 줌/팬 → 핀 CRUD → undo → 진행률 → 지원요청 → 가구수 수정
5. 오프라인 큐 + Realtime
6. 팀장 대시보드(/leader)
7. 관리자(/admin/$token): 지도 업로드/코드발급/가구수
