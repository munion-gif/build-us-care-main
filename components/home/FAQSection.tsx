"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { FAQItem } from "@/lib/faqs";

export function FAQSection({ faqs }: { faqs: FAQItem[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  if (faqs.length === 0) return null;

  return (
    <section className="faq-section" aria-labelledby="home-faq-title">
      <div className="faq-heading">
        <span>FAQ</span>
        <h2 id="home-faq-title">자주 묻는 질문</h2>
        <p>견적, 취소, A/S처럼 예약 전에 가장 많이 궁금해하시는 내용을 먼저 정리했어요.</p>
      </div>
      <div className="faq-list">
        {faqs.map((faq) => {
          const open = openId === faq.id;
          return (
            <article className={`faq-item ${open ? "open" : ""}`} key={faq.id}>
              <button
                aria-expanded={open}
                aria-controls={`faq-answer-${faq.id}`}
                type="button"
                onClick={() => setOpenId(open ? null : faq.id)}
              >
                <strong>{faq.question}</strong>
                <ChevronDown size={20} aria-hidden="true" />
              </button>
              {open && (
                <p id={`faq-answer-${faq.id}`}>
                  {faq.answer}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
