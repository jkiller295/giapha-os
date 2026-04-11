"use client";

import PersonCard from "@/components/PersonCard";
import { Person, Relationship } from "@/types";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import {
  ArrowUpDown,
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useDashboard } from "./DashboardContext";

export default function DashboardMemberList({
  initialPersons,
  relationships = [],
  canEdit = false,
}: {
  initialPersons: Person[];
  relationships?: Relationship[];
  canEdit?: boolean;
}) {
  const { setShowCreateMember } = useDashboard();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("generation_asc");
  const [filterOption, setFilterOption] = useState("all");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const exportToPdf = async () => {
    setIsExportingPdf(true);

    // ── Helpers ────────────────────────────────────────────────────────────
    const fmtDate = (y: number | null, m: number | null, d: number | null) => {
      if (!y && !m && !d) return "Chưa rõ";
      const parts: string[] = [];
      if (d) parts.push(d.toString().padStart(2, "0"));
      if (m) parts.push(m.toString().padStart(2, "0"));
      if (y) parts.push(y.toString());
      return parts.join("/");
    };

    // ── Build lookup maps from relationships ───────────────────────────────
    // marriedIds: has at least one non-divorced marriage
    // divorcedIds: has at least one divorced marriage
    // spousesMap: personId → list of spouse IDs (all marriages)
    const marriedIds = new Set<string>();
    const divorcedIds = new Set<string>();
    const spousesMap = new Map<string, string[]>();

    relationships.forEach((r) => {
      if (r.type === "marriage") {
        [r.person_a, r.person_b].forEach((id) => {
          if (!spousesMap.has(id)) spousesMap.set(id, []);
        });
        spousesMap.get(r.person_a)!.push(r.person_b);
        spousesMap.get(r.person_b)!.push(r.person_a);
        if (r.is_divorced) {
          divorcedIds.add(r.person_a);
          divorcedIds.add(r.person_b);
        } else {
          marriedIds.add(r.person_a);
          marriedIds.add(r.person_b);
        }
      }
    });

    // ── Group by generation ────────────────────────────────────────────────
    const byGen: Record<number, Person[]> = {};
    [...initialPersons]
      .sort((a, b) => (a.generation ?? 999) - (b.generation ?? 999))
      .forEach((p) => {
        const g = p.generation ?? 0;
        if (!byGen[g]) byGen[g] = [];
        byGen[g].push(p);
      });

    // ── Build couple groups within a generation ────────────────────────────
    // Each group is: [bloodlinePerson, ...spouses]
    // Bloodline person goes in the middle when there are multiple spouses.
    const buildCoupleGroups = (persons: Person[]): Person[][] => {
      const personSet = new Set(persons.map((p) => p.id));
      const placed = new Set<string>();
      const groups: Person[][] = [];

      for (const p of persons) {
        if (placed.has(p.id)) continue;
        placed.add(p.id);

        // Find spouses of this person that are also in this generation
        const spouseIds = (spousesMap.get(p.id) || []).filter(
          (id) => personSet.has(id) && !placed.has(id),
        );
        const spouses = spouseIds
          .map((id) => persons.find((q) => q.id === id)!)
          .filter(Boolean);
        spouses.forEach((s) => placed.add(s.id));

        if (spouses.length === 0) {
          groups.push([p]);
        } else if (spouses.length === 1) {
          // 2-col: bloodline first, spouse second
          const bloodline = !p.is_in_law ? p : spouses[0];
          const inlaw = !p.is_in_law ? spouses[0] : p;
          groups.push([bloodline, inlaw]);
        } else {
          // 3-col: bloodline in center, spouses on sides
          const bloodline = !p.is_in_law
            ? p
            : spouses.find((s) => !s.is_in_law) || p;
          const rest = [p, ...spouses].filter((q) => q.id !== bloodline.id);
          groups.push([rest[0], bloodline, ...rest.slice(1)]);
        }
      }
      return groups;
    };

    // ── Render a single person card as HTML string ─────────────────────────
    const personCard = (p: Person, shade: boolean) => {
      const dob = fmtDate(p.birth_year, p.birth_month, p.birth_day);
      const dod = p.is_deceased
        ? p.death_day || p.death_month || p.death_year
          ? fmtDate(p.death_year, p.death_month, p.death_day)
          : p.death_lunar_day || p.death_lunar_month || p.death_lunar_year
            ? fmtDate(
                p.death_lunar_year,
                p.death_lunar_month,
                p.death_lunar_day,
              ) + " (ÂL)"
            : "Chưa rõ"
        : null;
      const bloodline = p.is_in_law
        ? p.gender === "female"
          ? "Dâu"
          : p.gender === "male"
            ? "Rể"
            : "Khách"
        : "Huyết thống";
      const maritalStatus =
        divorcedIds.has(p.id) && p.is_in_law
          ? "Đã ly hôn"
          : marriedIds.has(p.id)
            ? "Đã kết hôn"
            : "Chưa kết hôn";
      const maritalColor =
        divorcedIds.has(p.id) && p.is_in_law
          ? "#dc2626"
          : marriedIds.has(p.id)
            ? "#16a34a"
            : "#78716c";
      const genderLabel =
        p.gender === "male" ? "Nam" : p.gender === "female" ? "Nữ" : "Khác";
      const genderColor =
        p.gender === "male"
          ? "#0369a1"
          : p.gender === "female"
            ? "#be185d"
            : "#57534e";
      const bloodlineColor = p.is_in_law ? "#9d174d" : "#44403c";
      const bg = shade ? "#fafaf9" : "#ffffff";

      const row = (label: string, value: string, color = "#1c1917") =>
        `<div style="display:flex;gap:8px;margin-bottom:3px;">
          <span style="font-size:11px;color:#a8a29e;width:110px;flex-shrink:0;">${label}</span>
          <span style="font-size:12px;color:${color};font-weight:500;">${value}</span>
        </div>`;

      return `
        <div style="border:1px solid #e7e5e4;border-radius:8px;padding:12px 14px;background:${bg};height:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f0efee;">
            <span style="font-size:13px;font-weight:bold;color:#1c1917;line-height:1.3;">
              ${p.full_name}${p.other_names ? ` <span style="font-weight:normal;color:#78716c;font-size:11px;">(${p.other_names})</span>` : ""}
            </span>
          </div>
          ${row("Giới tính", genderLabel, genderColor)}
          ${row("Ngày sinh", dob)}
          ${dod ? row("Ngày mất", dod) : ""}
          ${row("Hôn nhân", maritalStatus, maritalColor)}
          ${row("Huyết thống", bloodline, bloodlineColor)}
          ${p.note ? row("Ghi chú", p.note.slice(0, 60) + (p.note.length > 60 ? "…" : ""), "#78716c") : ""}
        </div>`;
    };

    // ── Render a couple group row ──────────────────────────────────────────
    const coupleRow = (group: Person[], shade: boolean) => {
      const cols = group.length; // 1, 2, or 3
      const colWidth =
        cols === 1 ? "580px" : cols === 2 ? "1fr 1fr" : "1fr 1fr 1fr";
      const wrapperWidth = cols === 1 ? "50%" : "100%";
      // For a single person, only take half the width
      const gridStyle =
        cols === 1
          ? `display:block;width:50%;`
          : `display:grid;grid-template-columns:${colWidth};gap:12px;`;

      // Amber highlight background for couples
      const coupleWrap =
        cols > 1
          ? `background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px;margin-bottom:12px;`
          : `margin-bottom:12px;width:50%;`;

      return `
        <div style="${coupleWrap}">
          <div style="${gridStyle}">
            ${group.map((p, i) => personCard(p, shade && i % 2 === 1)).join("")}
          </div>
        </div>`;
    };

    // ── Build HTML for one generation block ───────────────────────────────
    const generationBlock = (gen: string, persons: Person[]) => {
      const groups = buildCoupleGroups(persons);
      const rows = groups.map((g, i) => coupleRow(g, i % 2 === 1)).join("");
      return `
        <div>
          <div style="background:#92400e;padding:10px 20px;margin-bottom:16px;border-radius:6px;">
            <span style="font-size:16px;font-weight:bold;color:#ffffff;text-transform:uppercase;letter-spacing:0.1em;">
              ${gen === "0" ? "Chưa xác định đời" : `Đời thứ ${gen}`}
            </span>
            <span style="font-size:12px;color:#fde68a;margin-left:12px;">${persons.length} thành viên</span>
          </div>
          ${rows}
        </div>`;
    };

    // ── Render each generation as a separate element and capture ──────────
    // This avoids mid-card page cuts — each generation becomes one or more pages.
    const A4_W_PX = 1240;
    const A4_W_MM = 210;
    const A4_H_MM = 297;
    const PADDING = 48;
    const CONTENT_W = A4_W_PX - PADDING * 2;

    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(wrapper);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    let isFirstPage = true;

    const captureEl = async (el: HTMLElement): Promise<void> => {
      await new Promise((r) => setTimeout(r, 200));
      const imgData = await toJpeg(el, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 3,
        width: A4_W_PX,
      });
      const imgEl = new Image();
      await new Promise<void>((r) => {
        imgEl.onload = () => r();
        imgEl.src = imgData;
      });

      const totalH = imgEl.height;
      const pageH = Math.round((A4_H_MM / A4_W_MM) * imgEl.width);
      const pageCount = Math.ceil(totalH / pageH);
      const canvas = document.createElement("canvas");
      canvas.width = imgEl.width;

      for (let i = 0; i < pageCount; i++) {
        const sliceY = i * pageH;
        const sliceH = Math.min(pageH, totalH - sliceY);
        canvas.height = sliceH;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, sliceH);
        ctx.drawImage(
          imgEl,
          0,
          sliceY,
          imgEl.width,
          sliceH,
          0,
          0,
          imgEl.width,
          sliceH,
        );
        const sliceData = canvas.toDataURL("image/jpeg", 0.95);
        const sliceHMm = (sliceH / imgEl.width) * A4_W_MM;
        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;
        pdf.addImage(sliceData, "JPEG", 0, 0, A4_W_MM, sliceHMm);
      }
    };

    try {
      // Page 1: cover / title
      const titleHtml = `
        <div style="width:${A4_W_PX}px;background:#ffffff;font-family:Arial,sans-serif;padding:${PADDING}px;box-sizing:border-box;">
          <div style="text-align:center;padding:60px 0;">
            <h1 style="font-size:28px;font-weight:bold;color:#1c1917;margin:0;">DANH SÁCH THÀNH VIÊN GIA PHẢ</h1>
            <p style="font-size:14px;color:#78716c;margin-top:10px;">
              Xuất ngày ${new Date().toLocaleDateString("vi-VN")} · Tổng cộng ${initialPersons.length} thành viên
            </p>
          </div>
        </div>`;
      wrapper.innerHTML = titleHtml;
      await captureEl(wrapper.firstElementChild as HTMLElement);

      // One block per generation
      for (const [gen, persons] of Object.entries(byGen)) {
        const blockHtml = `
          <div style="width:${A4_W_PX}px;background:#ffffff;font-family:Arial,sans-serif;padding:${PADDING}px;box-sizing:border-box;">
            ${generationBlock(gen, persons)}
          </div>`;
        wrapper.innerHTML = blockHtml;
        await captureEl(wrapper.firstElementChild as HTMLElement);
      }

      // Footer page
      const footerHtml = `
        <div style="width:${A4_W_PX}px;background:#ffffff;font-family:Arial,sans-serif;padding:${PADDING}px;box-sizing:border-box;">
          <div style="border-top:1px solid #e7e5e4;padding-top:14px;text-align:center;color:#a8a29e;font-size:11px;width:${CONTENT_W}px;">
            Tài liệu được tạo tự động từ hệ thống Gia Phả
          </div>
        </div>`;
      wrapper.innerHTML = footerHtml;
      await captureEl(wrapper.firstElementChild as HTMLElement);

      pdf.save(
        `danh-sach-thanh-vien-${new Date().toISOString().split("T")[0]}.pdf`,
      );
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      document.body.removeChild(wrapper);
      setIsExportingPdf(false);
    }
  };

  const filteredPersons = useMemo(() => {
    return initialPersons.filter((person) => {
      const matchesSearch = person.full_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      switch (filterOption) {
        case "male":
          matchesFilter = person.gender === "male";
          break;
        case "female":
          matchesFilter = person.gender === "female";
          break;
        case "in_law_female":
          matchesFilter = person.gender === "female" && person.is_in_law;
          break;
        case "in_law_male":
          matchesFilter = person.gender === "male" && person.is_in_law;
          break;
        case "deceased":
          matchesFilter = person.is_deceased;
          break;
        case "first_child":
          matchesFilter = person.birth_order === 1;
          break;
        case "all":
        default:
          matchesFilter = true;
          break;
      }

      return matchesSearch && matchesFilter;
    });
  }, [initialPersons, searchTerm, filterOption]);

  const { parentsOf, spousesOf, divorcedPairs } = useMemo(() => {
    const pOf = new Map<string, string[]>();
    const sOf = new Map<string, string[]>();
    const dPairs = new Set<string>();

    relationships?.forEach((rel) => {
      if (rel.type === "biological_child" || rel.type === "adopted_child") {
        const parentId = rel.person_a;
        const childId = rel.person_b;
        if (!pOf.has(childId)) pOf.set(childId, []);
        pOf.get(childId)!.push(parentId);
      } else if (rel.type === "marriage") {
        const p1 = rel.person_a;
        const p2 = rel.person_b;
        if (!sOf.has(p1)) sOf.set(p1, []);
        if (!sOf.has(p2)) sOf.set(p2, []);
        sOf.get(p1)!.push(p2);
        sOf.get(p2)!.push(p1);
        if (rel.is_divorced) {
          // Store both orderings so lookup is easy
          dPairs.add(`${p1}__${p2}`);
          dPairs.add(`${p2}__${p1}`);
        }
      }
    });

    return { parentsOf: pOf, spousesOf: sOf, divorcedPairs: dPairs };
  }, [relationships]);

  const sortedPersons = useMemo(() => {
    // If not sorting by generation, use simple flat sort
    if (!sortOption.includes("generation")) {
      return [...filteredPersons].sort((a, b) => {
        switch (sortOption) {
          case "birth_asc":
            return (a.birth_year || 9999) - (b.birth_year || 9999);
          case "birth_desc":
            return (b.birth_year || 0) - (a.birth_year || 0);
          case "name_asc":
            return a.full_name.localeCompare(b.full_name, "vi");
          case "name_desc":
            return b.full_name.localeCompare(a.full_name, "vi");
          case "updated_desc":
            return (
              new Date(b.updated_at || 0).getTime() -
              new Date(a.updated_at || 0).getTime()
            );
          case "updated_asc":
            return (
              new Date(a.updated_at || 0).getTime() -
              new Date(b.updated_at || 0).getTime()
            );
          default:
            return 0;
        }
      });
    }

    // --- Complex Generation Sorting (Grouped by Family) ---
    // 1. Build basic maps
    const personMap = new Map<string, Person>();
    initialPersons.forEach((p) => personMap.set(p.id, p));

    // 2. Determine "Family Groups" within the same generation
    // We group people if they share the same parents, OR if they are spouses
    // A family groupId will be derived from:
    // a) Their parents' IDs (sorted and joined)
    // b) If no parents, their own ID (or their spouse's, whoever is sorted first)
    const getGroupId = (personId: string) => {
      const parents = parentsOf.get(personId) || [];
      if (parents.length > 0) {
        // Has parents -> group by parents
        return "parents_" + [...parents].sort().join("_");
      }

      // No parents -> check spouses and then check if those spouses have parents
      // Use a small BFS to find the whole marriage cluster
      const visited = new Set<string>([personId]);
      const queue = [personId];
      const cluster: string[] = [];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        cluster.push(curr);
        const pts = parentsOf.get(curr);
        if (pts && pts.length > 0) {
          // Found a bloodline member in the marriage cluster!
          return "parents_" + [...pts].sort().join("_");
        }

        const sps = spousesOf.get(curr) || [];
        for (const s of sps) {
          if (!visited.has(s)) {
            visited.add(s);
            queue.push(s);
          }
        }
      }

      // No one in marriage cluster has parents -> group by the cluster's min ID
      return "spouses_" + [...cluster].sort()[0];
    };

    // 3. Group the filtered persons into their families
    const families = new Map<string, Person[]>();
    filteredPersons.forEach((p) => {
      const groupId = getGroupId(p.id);
      if (!families.has(groupId)) families.set(groupId, []);
      families.get(groupId)!.push(p);
    });

    // 4. Sort families using lineage-based scoring
    // Each family is ranked by building a recursive "lineage score" from its core bloodline member.
    // The score includes ancestor → parent → self ordering (birth_order, then birth_year at each level).
    // This ensures deeper generations (e.g. 4th, 5th) inherit correct positioning from their full ancestry,
    // not just their immediate parent, resulting in stable and accurate family ordering across generations.
    const lineageScoreCache = new Map<string, number[]>();

    const getPrimaryBloodlineMember = (members: Person[]): Person => {
      return (
        members
          .filter((m: Person) => !m.is_in_law)
          .sort((a: Person, b: Person) => {
            if ((a.birth_order ?? 999) !== (b.birth_order ?? 999)) {
              return (a.birth_order ?? 999) - (b.birth_order ?? 999);
            }
            return (a.birth_year ?? 9999) - (b.birth_year ?? 9999);
          })[0] || members[0]
      );
    };

    const getBloodlineParent = (person: Person): Person | null => {
      const parentIds = parentsOf.get(person.id) || [];
      const parentPersons = parentIds
        .map((id: string) => personMap.get(id))
        .filter((p): p is Person => !!p);

      return (
        parentPersons.find((p: Person) => !p.is_in_law) ||
        parentPersons[0] ||
        null
      );
    };

    const getPersonLineageScore = (person: Person): number[] => {
      if (lineageScoreCache.has(person.id)) {
        return lineageScoreCache.get(person.id)!;
      }

      const parent = getBloodlineParent(person);

      const ownPart = [person.birth_order ?? 999, person.birth_year ?? 9999];

      if (!parent) {
        lineageScoreCache.set(person.id, ownPart);
        return ownPart;
      }

      const score = [...getPersonLineageScore(parent), ...ownPart];
      lineageScoreCache.set(person.id, score);
      return score;
    };

    const getFamilyScore = (_groupId: string, members: Person[]): number[] => {
      const coreMember = getPrimaryBloodlineMember(members);
      return getPersonLineageScore(coreMember);
    };

    const sortedGroups = Array.from(families.entries()).sort(
      (a: [string, Person[]], b: [string, Person[]]) => {
        const scoreA = getFamilyScore(a[0], a[1]);
        const scoreB = getFamilyScore(b[0], b[1]);

        const maxLen = Math.max(scoreA.length, scoreB.length);

        for (let i = 0; i < maxLen; i++) {
          const valA = scoreA[i] ?? 9999;
          const valB = scoreB[i] ?? 9999;

          if (valA !== valB) {
            return valA - valB;
          }
        }

        return 0;
      },
    );

    // 5. Flatten the grouped and sorted families
    const finalSorted: Array<Person & { _familyId?: string }> = [];
    sortedGroups.forEach(([groupId, members]) => {
      // Sort within the family (Siblings by birth order, spouses follow their partner)
      const getBloodlineRef = (p: Person) => {
        if (!p.is_in_law) return p;
        const spIds = spousesOf.get(p.id) || [];
        const bloodlineSpouse = members.find(
          (m) => spIds.includes(m.id) && !m.is_in_law,
        );
        return bloodlineSpouse || p;
      };

      members.sort((a, b) => {
        const refA = getBloodlineRef(a);
        const refB = getBloodlineRef(b);

        // Different bloodline partner -> sort by the bloodline partner's order/age
        if (refA.id !== refB.id) {
          if ((refA.birth_order || 999) !== (refB.birth_order || 999)) {
            return (refA.birth_order || 999) - (refB.birth_order || 999);
          }
          return (refA.birth_year || 9999) - (refB.birth_year || 9999);
        }

        // Same bloodline partner (e.g. one is bloodline, other is spouse)
        if (a.is_in_law !== b.is_in_law) {
          return a.is_in_law ? 1 : -1; // Bloodline first
        }

        // Both are spouses or both bloodline? Sort by age
        return (a.birth_year || 9999) - (b.birth_year || 9999);
      });
      finalSorted.push(...members.map((m) => ({ ...m, _familyId: groupId })));
    });

    // 6. Handle master generation_asc / generation_desc
    // `finalSorted` is now sorted ascending by family grouping and within family.
    // However, they might be mixed generations if we didn't strictly group by generation first.
    // Actually, the rendering code groups by generation AFTER this sort.
    // So if the outer sort wants desc, we just reverse the intra-generation logic?
    // Wait, the rendering code `Object.entries(...reduce(...))` groups by `generation`.
    // Then it sorts the generation keys.
    // Inside a single generation bucket, it preserves the array order.
    // So we just need to ensure the array provided to reduce is correctly ordered ascending.
    // If sortOption === 'generation_desc', the rendering sorts keys descending, but should it reverse within the generation?
    // Usually families are still displayed older->younger even if generations are grouped Z-A.
    // We will apply a default ascending flow to `finalSorted`.

    // If generation_desc is strictly needed across the whole list (if not grouped by UI later),
    // we'd sort by generation here. But since UI groups by generation, we just return `finalSorted`.
    // Let's ensure generation is the primary sort key just in case.
    finalSorted.sort((a, b) => {
      const genA = a.generation || 999;
      const genB = b.generation || 999;
      if (genA !== genB) {
        return sortOption === "generation_desc" ? genB - genA : genA - genB;
      }
      // If same generation, preserve the family sorting we just did
      return 0;
    });

    return finalSorted;
  }, [filteredPersons, sortOption, initialPersons, parentsOf, spousesOf]);

  return (
    <>
      <div className="mb-8 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-xl p-4 sm:p-5 rounded-2xl shadow-sm border border-stone-200/60 transition-all duration-300 relative z-10 w-full">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
            <div className="relative flex-1 max-w-sm group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-stone-400 group-focus-within:text-amber-500 transition-colors" />
              <input
                type="text"
                placeholder="Tìm kiếm thành viên..."
                className="bg-white/90 text-stone-900 w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200/80 shadow-sm placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto items-center">
              <div className="relative w-full sm:w-auto">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-400 pointer-events-none" />
                <select
                  className="appearance-none bg-white/90 text-stone-700 w-full sm:w-40 pl-9 pr-8 py-2.5 rounded-xl border border-stone-200/80 shadow-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 hover:border-amber-300 font-medium text-sm transition-all focus:bg-white"
                  value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value)}
                >
                  <option value="all">Tất cả</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="in_law_female">Dâu</option>
                  <option value="in_law_male">Rể</option>
                  <option value="deceased">Đã mất</option>
                  <option value="first_child">Con trưởng</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <svg
                    className="size-4 text-stone-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </div>
              </div>

              <div className="relative w-full sm:w-auto">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-400 pointer-events-none" />
                <select
                  className="appearance-none bg-white/90 text-stone-700 w-full sm:w-60 pl-9 pr-8 py-2.5 rounded-xl border border-stone-200/80 shadow-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 hover:border-amber-300 font-medium text-sm transition-all focus:bg-white"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                >
                  <option value="birth_asc">Năm sinh (Tăng dần)</option>
                  <option value="birth_desc">Năm sinh (Giảm dần)</option>
                  <option value="name_asc">Tên (A-Z)</option>
                  <option value="name_desc">Tên (Z-A)</option>
                  <option value="updated_desc">Cập nhật (Mới nhất)</option>
                  <option value="updated_asc">Cập nhật (Cũ nhất)</option>
                  <option value="generation_asc">Theo thế hệ (Tăng dần)</option>
                  <option value="generation_desc">
                    Theo thế hệ (Giảm dần)
                  </option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <svg
                    className="size-4 text-stone-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPdf}
              disabled={isExportingPdf}
              className="btn"
              title="Xuất danh sách thành viên ra PDF"
            >
              {isExportingPdf ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <FileText className="size-4 shrink-0" />
              )}
              <span className="hidden sm:inline tracking-wide min-w-max">
                {isExportingPdf ? "Đang xuất..." : "Xuất PDF"}
              </span>
            </button>
            {canEdit && (
              <button
                onClick={() => setShowCreateMember(true)}
                className="btn-primary"
              >
                <Plus className="size-4" strokeWidth={2.5} />
                Thêm thành viên
              </button>
            )}
          </div>
        </div>
      </div>

      {sortedPersons.length > 0 ? (
        sortOption.includes("generation") ? (
          <div className="space-y-12">
            {Object.entries(
              sortedPersons.reduce(
                (acc, person) => {
                  const gen = person.generation || 0;
                  if (!acc[gen]) acc[gen] = [];
                  acc[gen].push(person);
                  return acc;
                },
                {} as Record<number, Person[]>,
              ),
            )
              .sort(([genA], [genB]) => {
                if (sortOption === "generation_desc") {
                  return Number(genB) - Number(genA);
                }
                return Number(genA) - Number(genB);
              })
              .map(([gen, persons]) => {
                const familiesMap = new Map<string, typeof persons>();
                persons.forEach((p) => {
                  const fid =
                    (p as Person & { _familyId?: string })._familyId ||
                    "unknown";
                  if (!familiesMap.has(fid)) familiesMap.set(fid, []);
                  familiesMap.get(fid)!.push(p);
                });

                return (
                  <div key={gen} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-stone-200"></div>
                      <h3 className="text-lg font-sans font-bold text-amber-800 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200/50 shadow-sm">
                        {gen === "0" ? "Chưa xác định đời" : `Đời thứ ${gen}`}
                      </h3>
                      <div className="h-px flex-1 bg-stone-200"></div>
                    </div>
                    <div className="space-y-12">
                      {Array.from(familiesMap.values()).map(
                        (famPersons, idx) => (
                          <div
                            key={idx}
                            className="relative bg-white border border-stone-300 rounded-[2.5rem] p-5 sm:p-8 shadow-sm"
                          >
                            {(() => {
                              const firstBloodline =
                                famPersons.find((p) => !p.is_in_law) ||
                                famPersons[0];
                              const parentIds =
                                parentsOf.get(firstBloodline.id) || [];
                              const parents = parentIds
                                .map((id) =>
                                  initialPersons.find((p) => p.id === id),
                                )
                                .filter(Boolean) as Person[];
                              const parentNames = parents
                                .map((p) =>
                                  p.full_name
                                    .trim()
                                    .split(" ")
                                    .splice(-2)
                                    .join(" "),
                                )
                                .join(" & ");

                              const label = parentNames
                                ? `Con của: ${parentNames}`
                                : familiesMap.size > 1
                                  ? `Gia đình ${idx + 1}`
                                  : null;

                              if (!label) return null;

                              return (
                                <div className="absolute -top-3 left-8 px-3 py-0.5 bg-stone-100 text-xs font-bold text-stone-600 tracking-widest border border-stone-300 rounded-full shadow-sm z-20">
                                  {label}
                                </div>
                              );
                            })()}
                            <div
                              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10`}
                            >
                              {(() => {
                                // Group famPersons into couple groups strictly by spouse relationships
                                const coupleGroups: Person[][] = [];
                                const placed = new Set<string>();

                                for (const p of famPersons) {
                                  if (placed.has(p.id)) continue;
                                  const group = [p];
                                  placed.add(p.id);

                                  // Find all spouses connected to this person
                                  const queue = [p.id];
                                  while (queue.length > 0) {
                                    const curr = queue.shift()!;
                                    const spIds = spousesOf.get(curr) || [];
                                    for (const spId of spIds) {
                                      if (!placed.has(spId)) {
                                        const spObj = famPersons.find(
                                          (m) => m.id === spId,
                                        );
                                        if (spObj) {
                                          group.push(spObj);
                                          placed.add(spId);
                                          queue.push(spId);
                                        }
                                      }
                                    }
                                  }

                                  // Balanced Sort: Place bloodline members in the center
                                  // This ensures HUB -- SPOUSE links work best in a horizontal grid.
                                  const bloodlineMembers = group
                                    .filter((m) => !m.is_in_law)
                                    .sort(
                                      (a, b) =>
                                        (a.birth_year || 0) -
                                        (b.birth_year || 0),
                                    );
                                  const inLawMembers = group
                                    .filter((m) => m.is_in_law)
                                    .sort(
                                      (a, b) =>
                                        (a.birth_year || 0) -
                                        (b.birth_year || 0),
                                    );

                                  const balanced: Person[] = [];
                                  if (group.length <= 2) {
                                    balanced.push(
                                      ...bloodlineMembers,
                                      ...inLawMembers,
                                    );
                                  } else {
                                    // For 3+ people, put the main person(s) in the middle
                                    // Example for 3: [InLaw 1, Bloodline, InLaw 2]
                                    let bIdx = 0;
                                    let iIdx = 0;
                                    const slots = new Array(group.length);

                                    // Put bloodline in center or near center
                                    const mid = Math.floor(group.length / 2);
                                    slots[mid] = bloodlineMembers[bIdx++];

                                    // Distribute others around
                                    let offset = 1;
                                    while (
                                      bIdx < bloodlineMembers.length ||
                                      iIdx < inLawMembers.length
                                    ) {
                                      const next =
                                        bIdx < bloodlineMembers.length
                                          ? bloodlineMembers[bIdx++]
                                          : inLawMembers[iIdx++];
                                      if (
                                        mid + offset < group.length &&
                                        !slots[mid + offset]
                                      )
                                        slots[mid + offset] = next;
                                      else if (
                                        mid - offset >= 0 &&
                                        !slots[mid - offset]
                                      )
                                        slots[mid - offset] = next;
                                      else {
                                        // Find first empty slot
                                        const empty = slots.findIndex(
                                          (s) => !s,
                                        );
                                        if (empty !== -1) slots[empty] = next;
                                      }
                                      offset++;
                                    }
                                    balanced.push(...slots.filter((s) => !!s));
                                  }

                                  coupleGroups.push(balanced);
                                }
                                return coupleGroups.map((group, gIdx) => {
                                  const isCouple = group.length > 1;
                                  const colSpanClass =
                                    group.length === 2
                                      ? "md:col-span-2"
                                      : group.length >= 3
                                        ? "md:col-span-2 lg:col-span-3"
                                        : "col-span-1";
                                  const innerGridClass =
                                    group.length === 2
                                      ? "md:grid-cols-2"
                                      : group.length >= 3
                                        ? "md:grid-cols-2 lg:grid-cols-3"
                                        : "grid-cols-1";

                                  // Check if any pair in this couple group is divorced
                                  const isGroupDivorced = group.some((p, i) =>
                                    group.some(
                                      (q, j) =>
                                        i !== j &&
                                        divorcedPairs.has(`${p.id}__${q.id}`),
                                    ),
                                  );

                                  return (
                                    <div
                                      key={gIdx}
                                      className={`relative ${colSpanClass}`}
                                    >
                                      {isCouple && (
                                        <>
                                          {/* Desktop & Tablet background */}
                                          <div
                                            className={`hidden md:block absolute -inset-3 lg:-inset-4 border rounded-4xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] z-0 ${isGroupDivorced ? "bg-red-50/50 border-red-200/70" : "bg-amber-50/70 border-amber-200/80"}`}
                                          ></div>
                                          {/* Mobile background */}
                                          <div
                                            className={`md:hidden absolute -inset-2 border rounded-3xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] z-0 ${isGroupDivorced ? "bg-red-50/50 border-red-200/70" : "bg-amber-50/70 border-amber-200/80"}`}
                                          ></div>
                                        </>
                                      )}
                                      <div
                                        className={`relative z-10 grid grid-cols-1 ${innerGridClass} gap-y-6 md:gap-x-6 h-full`}
                                      >
                                        {group.map((person, pIdx) => {
                                          // Is this specific person divorced from the next person in the group?
                                          const nextPerson = group[pIdx + 1];
                                          const isLinkDivorced =
                                            nextPerson != null &&
                                            divorcedPairs.has(
                                              `${person.id}__${nextPerson.id}`,
                                            );
                                          const isPersonDivorced =
                                            person.is_in_law &&
                                            group.some(
                                              (q, j) =>
                                                j !== pIdx &&
                                                divorcedPairs.has(
                                                  `${person.id}__${q.id}`,
                                                ),
                                            );

                                          return (
                                            <div
                                              key={person.id}
                                              className="relative h-full flex flex-col"
                                            >
                                              <PersonCard
                                                person={person}
                                                isDivorced={isPersonDivorced}
                                              />
                                              {/* Visual link between spouses (desktop >= md) */}
                                              {isCouple &&
                                                pIdx < group.length - 1 &&
                                                (isLinkDivorced ? (
                                                  <div
                                                    className="hidden md:block absolute top-[50%] -right-3 w-6 z-10 translate-x-1/2"
                                                    style={{
                                                      borderTop:
                                                        "2px dashed #fca5a5",
                                                    }}
                                                  ></div>
                                                ) : (
                                                  <div className="hidden md:block absolute top-[50%] -right-3 w-6 h-0.5 bg-amber-300 z-10 translate-x-1/2"></div>
                                                ))}
                                              {/* Visual link between spouses (mobile < md) */}
                                              {isCouple &&
                                                pIdx < group.length - 1 &&
                                                (isLinkDivorced ? (
                                                  <div
                                                    className="md:hidden absolute -bottom-6 left-1/2 h-6 z-10 -translate-x-1/2"
                                                    style={{
                                                      borderLeft:
                                                        "2px dashed #fca5a5",
                                                    }}
                                                  ></div>
                                                ) : (
                                                  <div className="md:hidden absolute -bottom-6 left-1/2 w-0.5 h-6 bg-amber-300 z-10 -translate-x-1/2"></div>
                                                ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPersons.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-12 text-stone-400 italic">
          {initialPersons.length > 0
            ? "Không tìm thấy thành viên phù hợp."
            : "Chưa có thành viên nào. Hãy thêm thành viên đầu tiên."}
        </div>
      )}
    </>
  );
}
