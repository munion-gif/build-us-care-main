"use client";

import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";

type NextActionCardProps = {
  orderStatus: string;
  canCancel: boolean;
  canReschedule: boolean;
  showFeedback: boolean;
  kakaoUrl: string | null;
  onFeedback: () => void;
  onWarranty: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onShare: () => void;
};

export function NextActionCard({
  orderStatus,
  canCancel,
  canReschedule,
  showFeedback,
  kakaoUrl,
  onFeedback,
  onWarranty,
  onCancel,
  onReschedule,
  onShare
}: NextActionCardProps) {
  const primary = getPrimaryAction({ orderStatus, canReschedule, showFeedback, onFeedback, onWarranty, onReschedule, onShare });
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  return (
    <section className="order-card next-action-card" aria-label="다음 액션">
      <span>다음에 할 일</span>
      <h2>{primary.title}</h2>
      <p>{primary.body}</p>
      <div className="next-action-buttons">
        <button type="button" onClick={primary.onClick}>{primary.label}</button>
        {canCancel && <button type="button" className="secondary" onClick={onCancel}>취소 요청</button>}
        {kakaoChatUrl && <a href={kakaoChatUrl} target="_blank" rel="noreferrer">카톡 문의</a>}
      </div>
    </section>
  );
}

function getPrimaryAction(params: {
  orderStatus: string;
  canReschedule: boolean;
  showFeedback: boolean;
  onFeedback: () => void;
  onWarranty: () => void;
  onReschedule: () => void;
  onShare: () => void;
}) {
  if (params.showFeedback) return { title: "시공은 만족스러우셨나요?", body: "후기를 남기면 다음 고객에게 큰 도움이 됩니다.", label: "후기 남기기", onClick: params.onFeedback };
  if (params.orderStatus === "done") return { title: "불편한 점이 있나요?", body: "완료 후 문제는 같은 주문 링크에서 A/S로 접수할 수 있어요.", label: "A/S 접수하기", onClick: params.onWarranty };
  if (params.orderStatus === "completed") return { title: "작업 완료 확인 중입니다", body: "최종 완료 처리 후 후기와 A/S 접수가 열립니다. 지금은 담당자가 마무리 확인 중이에요.", label: "주문 링크 공유", onClick: params.onShare };
  if (params.orderStatus === "warranty") return { title: "A/S가 접수되었습니다", body: "담당자가 내용을 확인하고 필요한 일정이나 조치 방향을 안내드릴 예정입니다.", label: "주문 링크 공유", onClick: params.onShare };
  if (params.orderStatus === "issue") return { title: "확인이 필요한 내용이 있어요", body: "담당자가 문제 내용을 확인 중입니다. 안내 전까지 이 링크에서 진행 상황을 확인해주세요.", label: "주문 링크 공유", onClick: params.onShare };
  if (params.canReschedule) return { title: "방문 일정이 필요하신가요?", body: "방문 전이라면 가능한 일정으로 변경 요청할 수 있어요.", label: "예약 변경", onClick: params.onReschedule };
  return { title: "주문 링크를 보관해주세요", body: "이 링크에서 기사 배정, 방문 일정, A/S 접수까지 계속 확인할 수 있어요.", label: "주문 링크 공유", onClick: params.onShare };
}
