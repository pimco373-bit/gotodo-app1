# GOTODO // EXECUTIVE CALENDAR & AGENDA

> 바쁜 직장인을 위해 30초 안에 오늘의 업무를 확인하고 체크할 수 있도록 최적화된 하이엔드 미니멀 캘린더 & 투두 웹 애플리케이션입니다.

---

## ✦ 디자인 아이덴티티 (Design System)
- **미학 (Aesthetic)**: ZARA 공식 웹사이트 특유의 절제된 타이포그래피와 차갑고 고급스러운 미니멀리즘.
- **배경색 (Background)**: 시각적 피로를 최소화하는 순수 블랙 (`#000000`).
- **메인 포인트 컬러 (Primary Accent)**: 형광 초록 (`#00FF66`)
  - `ADD +`, `TODAY JUMP` 버튼
  - 오늘 날짜(Today) 상시 테두리 및 도트 인디케이터
  - 커스텀 체크박스 활성화 상태
- **서브 포인트 컬러 (Secondary Accent)**: 핫핑크 (`#FF007F`)
  - **긴급(URGENT) 우선순위 할 일에만 독점 사용**

---

## ✦ 핵심 기능 (Key Features)
1. **월간 캘린더 뷰**: 월간 일정 조망, 이전/다음 달 이동 및 `TODAY JUMP` 기능.
2. **오늘 날짜 상시 강조**: 언제나 오늘 날짜가 형광 초록 테두리와 도트로 명확하게 강조 표시.
3. **날짜별 일정 격리 & 도트 인디케이터**: 날짜 셀에 업무 유무(초록 점) 및 긴급 업무 포함 여부(핫핑크 점) 표시.
4. **초고속 할 일 등록**: 제목 입력 + 3단계 우선순위(긴급 / 보통 / 낮음) 선택 후 `Enter` 즉시 등록.
5. **완료 상태 시각화**: 원클릭 체크 시 취소선(`line-through`) 및 투명도 35% 흐림 처리.
6. **진행률 게이지**: 완료 건수 / 전체 건수 비율을 실시간 프로그레스 바로 시각화.
7. **Firebase Firestore 클라우드 실시간 동기화**:
   - Google Firebase Firestore v13 모듈러 SDK 연동으로 실시간(`onSnapshot`) 다중 기기/탭 동기화 지원.
   - 네트워크 단절이나 규칙 미설정 시에도 브라우저 `localStorage` 캐시를 통한 무중단 오프라인 모드 지원.
   - 상단 헤더의 실시간 클라우드 상태 배지(`FIRESTORE SYNC: ACTIVE` / `RULES NEEDED`) 제공.

---

## ✦ 기술 스택 (Tech Stack)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+ Modules)
- **Database / Cloud**: Google Firebase Firestore (SDK v13.1.0)
- **Persistence**: Firebase Firestore + LocalStorage Hybrid Fallback Cache

---

## ✦ Firebase Firestore 규칙 설정 안내 (중요)
Firebase 콘솔에서 데이터베이스를 처음 생성하셨다면 읽기/쓰기 권한을 허용해야 클라우드 저장이 작동합니다:

1. [Firebase Console](https://console.firebase.google.com/project/gotodo-app1/firestore/rules) 접속
2. **Firestore Database > 규칙(Rules)** 탭 선택
3. 아래 규칙으로 설정 후 **[게시(Publish)]** 클릭:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## ✦ 실행 방법
별도의 빌드 과정 없이 `index.html` 파일을 웹 브라우저 또는 로컬 웹 서버(Live Server 등)에서 바로 실행할 수 있습니다.
