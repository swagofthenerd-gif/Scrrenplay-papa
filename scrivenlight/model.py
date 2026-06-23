"""
Document model. A screenplay is a sequence of blocks, each with an
ElementType and text. Handles save/load to a simple JSON format (.slt)
and import/export of Fountain (the open screenplay text format).
"""

import json
import re
from dataclasses import dataclass, field, asdict
from typing import List

from .elements import ElementType, SCENE_PREFIXES, TRANSITION_WORDS


@dataclass
class Block:
    type: str            # ElementType value string
    text: str = ""

    def etype(self) -> ElementType:
        return ElementType(self.type)


@dataclass
class Screenplay:
    title: str = "Untitled"
    author: str = ""
    blocks: List[Block] = field(default_factory=list)

    def to_dict(self):
        return {
            "format": "scrivenlight-1",
            "title": self.title,
            "author": self.author,
            "blocks": [asdict(b) for b in self.blocks],
        }

    @classmethod
    def from_dict(cls, d):
        sp = cls(title=d.get("title", "Untitled"),
                 author=d.get("author", ""))
        sp.blocks = [Block(b["type"], b.get("text", "")) for b in d.get("blocks", [])]
        if not sp.blocks:
            sp.blocks = [Block(ElementType.SCENE_HEADING.value, "")]
        return sp

    # ---- native format ----
    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    @classmethod
    def load(cls, path: str):
        with open(path, "r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    # ---- Fountain export ----
    def to_fountain(self) -> str:
        out = []
        if self.title:
            out.append(f"Title: {self.title}")
        if self.author:
            out.append(f"Author: {self.author}")
        if out:
            out.append("")  # title page separator
        for b in self.blocks:
            t = b.etype()
            txt = b.text
            if t == ElementType.SCENE_HEADING:
                out.append("")
                out.append(txt.upper())
            elif t == ElementType.ACTION:
                out.append("")
                out.append(txt)
            elif t == ElementType.CHARACTER:
                out.append("")
                out.append(txt.upper())
            elif t == ElementType.PARENTHETICAL:
                p = txt.strip()
                if not p.startswith("("):
                    p = f"({p})"
                out.append(p)
            elif t == ElementType.DIALOGUE:
                out.append(txt)
            elif t == ElementType.TRANSITION:
                out.append("")
                out.append("> " + txt.upper())
            else:
                out.append(txt)
        return "\n".join(out).strip() + "\n"

    @classmethod
    def from_fountain(cls, text: str):
        sp = cls()
        lines = text.replace("\r\n", "\n").split("\n")
        i = 0
        # title page
        while i < len(lines) and ":" in lines[i] and lines[i].strip():
            key, _, val = lines[i].partition(":")
            k = key.strip().lower()
            if k == "title":
                sp.title = val.strip()
            elif k == "author":
                sp.author = val.strip()
            i += 1
        blocks: List[Block] = []
        prev_blank = True
        for line in lines[i:]:
            raw = line.rstrip()
            stripped = raw.strip()
            if not stripped:
                prev_blank = True
                continue
            up = stripped.upper()
            etype = ElementType.ACTION
            if any(up.startswith(p) for p in SCENE_PREFIXES):
                etype = ElementType.SCENE_HEADING
            elif stripped.startswith(">"):
                etype = ElementType.TRANSITION
                stripped = stripped.lstrip(">").strip()
            elif up in TRANSITION_WORDS or up.endswith("TO:"):
                etype = ElementType.TRANSITION
            elif stripped.startswith("(") and stripped.endswith(")"):
                etype = ElementType.PARENTHETICAL
            elif up == stripped and prev_blank and len(stripped) < 40 and not stripped.endswith("."):
                etype = ElementType.CHARACTER
            elif blocks and blocks[-1].etype() in (
                    ElementType.CHARACTER, ElementType.PARENTHETICAL, ElementType.DIALOGUE):
                etype = ElementType.DIALOGUE
            blocks.append(Block(etype.value, stripped))
            prev_blank = False
        if not blocks:
            blocks = [Block(ElementType.SCENE_HEADING.value, "")]
        sp.blocks = blocks
        return sp

    # ---- stats ----
    def scene_count(self) -> int:
        return sum(1 for b in self.blocks if b.etype() == ElementType.SCENE_HEADING)

    def word_count(self) -> int:
        return sum(len(re.findall(r"\w+", b.text)) for b in self.blocks)
