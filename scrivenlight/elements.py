"""
Screenplay element definitions following industry-standard formatting.
All measurements based on the standard US Letter screenplay layout where
1 inch = 1 character pitch at 12pt Courier (10 chars per inch, 6 lines per inch).
"""

from dataclasses import dataclass
from enum import Enum


class ElementType(Enum):
    SCENE_HEADING = "scene_heading"      # INT./EXT. LOCATION - DAY
    ACTION = "action"                    # Description / action lines
    CHARACTER = "character"              # CHARACTER NAME (centered-ish)
    DIALOGUE = "dialogue"                # Spoken lines
    PARENTHETICAL = "parenthetical"      # (beat) (whispering)
    TRANSITION = "transition"            # CUT TO: / FADE OUT.
    SHOT = "shot"                        # ANGLE ON / CLOSE ON
    GENERAL = "general"                  # Free text / unstyled


# Left indent and width in *characters* from the left text margin.
# The page itself has a 1.5" left margin and 1" right margin baked into the
# page widget, so these are relative to the typing area.
#
# Standard screenplay metrics (in inches from left page edge -> we translate):
#   Scene heading / Action:      left 1.5"  width 6.0"
#   Character:                   left 3.7"  (~2.2" from action margin)
#   Parenthetical:               left 3.1"  width ~2.0"
#   Dialogue:                    left 2.5"  width ~3.5"
#   Transition:                  right-aligned
#
# We express these as left margin (in inches) and right margin (in inches)
# from the page edges, used by the editor to position blocks.

@dataclass(frozen=True)
class ElementStyle:
    name: str
    left_in: float        # left indent from page's left edge (inches)
    right_in: float       # right indent from page's right edge (inches)
    uppercase: bool
    align: str            # 'left' | 'right'
    space_before: int     # blank lines before (in 12pt line units)
    # The element that ENTER creates after this one
    enter_to: ElementType
    # The element TAB cycles to from this one
    tab_to: ElementType


PAGE_WIDTH_IN = 8.5
PAGE_HEIGHT_IN = 11.0
TOP_MARGIN_IN = 1.0
BOTTOM_MARGIN_IN = 1.0
LEFT_EDGE_IN = 1.5    # standard screenplay left margin (room for binding)
RIGHT_EDGE_IN = 1.0


STYLES = {
    ElementType.SCENE_HEADING: ElementStyle(
        name="Scene Heading", left_in=1.5, right_in=1.0, uppercase=True,
        align="left", space_before=1,
        enter_to=ElementType.ACTION, tab_to=ElementType.ACTION),
    ElementType.ACTION: ElementStyle(
        name="Action", left_in=1.5, right_in=1.0, uppercase=False,
        align="left", space_before=1,
        enter_to=ElementType.ACTION, tab_to=ElementType.CHARACTER),
    ElementType.CHARACTER: ElementStyle(
        name="Character", left_in=3.7, right_in=1.0, uppercase=True,
        align="left", space_before=1,
        enter_to=ElementType.DIALOGUE, tab_to=ElementType.TRANSITION),
    ElementType.DIALOGUE: ElementStyle(
        name="Dialogue", left_in=2.5, right_in=2.0, uppercase=False,
        align="left", space_before=0,
        enter_to=ElementType.CHARACTER, tab_to=ElementType.PARENTHETICAL),
    ElementType.PARENTHETICAL: ElementStyle(
        name="Parenthetical", left_in=3.1, right_in=2.4, uppercase=False,
        align="left", space_before=0,
        enter_to=ElementType.DIALOGUE, tab_to=ElementType.DIALOGUE),
    ElementType.TRANSITION: ElementStyle(
        name="Transition", left_in=1.5, right_in=1.0, uppercase=True,
        align="right", space_before=1,
        enter_to=ElementType.SCENE_HEADING, tab_to=ElementType.SCENE_HEADING),
    ElementType.SHOT: ElementStyle(
        name="Shot", left_in=1.5, right_in=1.0, uppercase=True,
        align="left", space_before=1,
        enter_to=ElementType.ACTION, tab_to=ElementType.ACTION),
    ElementType.GENERAL: ElementStyle(
        name="General", left_in=1.5, right_in=1.0, uppercase=False,
        align="left", space_before=0,
        enter_to=ElementType.GENERAL, tab_to=ElementType.SCENE_HEADING),
}


SCENE_PREFIXES = ("INT.", "EXT.", "INT./EXT.", "EST.", "I/E.")
TRANSITION_WORDS = ("CUT TO:", "FADE OUT.", "FADE IN:", "DISSOLVE TO:",
                    "SMASH CUT TO:", "MATCH CUT TO:", "FADE TO BLACK.")


def guess_element_for_text(text: str) -> ElementType:
    """Heuristic auto-detection used when the user types certain patterns."""
    t = text.strip().upper()
    if not t:
        return ElementType.ACTION
    for p in SCENE_PREFIXES:
        if t.startswith(p):
            return ElementType.SCENE_HEADING
    for w in TRANSITION_WORDS:
        if t == w or t.endswith("TO:"):
            return ElementType.TRANSITION
    return ElementType.ACTION
