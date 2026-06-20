"""
Génère docs/algo_predictions.pdf — explication du modèle de Poisson v4
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Preformatted, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

W, H = A4
MARGIN = 2 * cm

doc = SimpleDocTemplate(
    "docs/algo_predictions_v2.pdf",
    pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
)

styles = getSampleStyleSheet()

# ── Palette ────────────────────────────────────────────────────────────────────
DARK     = colors.HexColor("#0f172a")   # texte principal
ACCENT   = colors.HexColor("#0369a1")   # titres H1 (bleu foncé lisible)
GRAY     = colors.HexColor("#334155")   # texte secondaire
DGRAY    = colors.HexColor("#1e293b")   # notes
CODE_BG  = colors.HexColor("#1e293b")   # fond code
CODE_FG  = colors.HexColor("#e2e8f0")   # texte code (sur fond sombre)
HDR_BG   = colors.HexColor("#0f172a")   # en-tête tableaux
STRIPE1  = colors.HexColor("#f0f9ff")   # lignes paires
STRIPE2  = colors.white
GOLD     = colors.HexColor("#b45309")   # note d'avertissement

# ── Styles ─────────────────────────────────────────────────────────────────────
title_style = ParagraphStyle("MyTitle",
    fontName="Helvetica-Bold", fontSize=20, textColor=DARK,
    spaceAfter=4, alignment=TA_CENTER)

subtitle_style = ParagraphStyle("MySub",
    fontName="Helvetica", fontSize=10, textColor=GRAY,
    spaceAfter=16, alignment=TA_CENTER)

h1_style = ParagraphStyle("MyH1",
    fontName="Helvetica-Bold", fontSize=13, textColor=ACCENT,
    spaceBefore=18, spaceAfter=6)

h2_style = ParagraphStyle("MyH2",
    fontName="Helvetica-Bold", fontSize=10.5, textColor=DARK,
    spaceBefore=10, spaceAfter=4)

body_style = ParagraphStyle("MyBody",
    fontName="Helvetica", fontSize=9.5, textColor=DARK,
    leading=14, spaceAfter=6, alignment=TA_JUSTIFY)

note_style = ParagraphStyle("MyNote",
    fontName="Helvetica-Oblique", fontSize=9, textColor=DGRAY,
    leading=13, spaceAfter=6, leftIndent=10,
    borderPad=4)

footer_style = ParagraphStyle("MyFooter",
    fontName="Helvetica", fontSize=8, textColor=GRAY,
    alignment=TA_CENTER)

# Texte dans le code (sur fond sombre)
code_inner = ParagraphStyle("CodeInner",
    fontName="Courier", fontSize=8.5, textColor=CODE_FG,
    leading=13, leftIndent=0)

# ── Helpers ───────────────────────────────────────────────────────────────────
def H1(text):
    return Paragraph(text, h1_style)

def H2(text):
    return Paragraph(text, h2_style)

def P(text):
    return Paragraph(text, body_style)

def Note(text):
    # Boîte légèrement colorée pour les notes
    inner = Paragraph(f"<b>ℹ</b>  {text}", note_style)
    t = Table([[inner]], colWidths=[W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#f0f9ff")),
        ("BOX",        (0,0), (-1,-1), 0.5, colors.HexColor("#7dd3fc")),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING",   (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
    ]))
    return t

def Code(text):
    # Table avec fond sombre — la seule façon fiable dans ReportLab
    inner = Preformatted(text, ParagraphStyle("CI",
        fontName="Courier", fontSize=8.5, textColor=CODE_FG, leading=13))
    t = Table([[inner]], colWidths=[W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), CODE_BG),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return t

def SP(n=6):
    return Spacer(1, n)

def HR():
    return HRFlowable(width="100%", thickness=0.5,
                      color=colors.HexColor("#cbd5e1"), spaceAfter=8)

def data_table(data, col_widths, stripe1=STRIPE1):
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",     (0,0),  (-1,0),  HDR_BG),
        ("TEXTCOLOR",      (0,0),  (-1,0),  colors.white),
        ("FONTNAME",       (0,0),  (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",       (0,0),  (-1,-1), 8.5),
        ("ALIGN",          (1,0),  (-1,-1), "CENTER"),
        ("ALIGN",          (0,0),  (0,-1),  "LEFT"),
        ("ROWBACKGROUNDS", (0,1),  (-1,-1), [stripe1, STRIPE2]),
        ("TEXTCOLOR",      (0,1),  (-1,-1), DARK),
        ("GRID",           (0,0),  (-1,-1), 0.4, colors.HexColor("#cbd5e1")),
        ("TOPPADDING",     (0,0),  (-1,-1), 4),
        ("BOTTOMPADDING",  (0,0),  (-1,-1), 4),
        ("LEFTPADDING",    (0,0),  (-1,-1), 6),
        ("RIGHTPADDING",   (0,0),  (-1,-1), 6),
    ]))
    return t

# ── Document ───────────────────────────────────────────────────────────────────
story = []

# Titre
story += [
    SP(8),
    Paragraph("Coupe du Monde 2026", subtitle_style),
    Paragraph("Algorithme de prédiction des scores", title_style),
    Paragraph("Modèle de Poisson bivarié v4 — Staging", subtitle_style),
    HR(),
    SP(4),
]

# ── 1. Vue d'ensemble ──────────────────────────────────────────────────────────
story += [
    H1("1. Vue d'ensemble"),
    P("Le modèle prédit le score de chaque match à venir en modélisant les buts de chaque "
      "équipe comme deux variables aléatoires <b>indépendantes</b> suivant une loi de "
      "Poisson de paramètres λ<sub>A</sub> et λ<sub>B</sub>. La distribution jointe "
      "donne la probabilité de chaque score exact :"),
    SP(4),
    Code("P(A=i, B=j)  =  Poisson(i, λA) × Poisson(j, λB)"),
    SP(6),
    P("Les paramètres λ sont construits en deux temps : un <b>prior FIFA</b> basé sur le "
      "classement officiel (avant tout match), puis une <b>régression bayésienne</b> qui "
      "intègre progressivement les statistiques réelles au fil des matchs joués."),
    SP(6),
]

# ── 2. Prior FIFA ──────────────────────────────────────────────────────────────
story += [
    H1("2. Prior FIFA"),
    P("Avant tout match joué, chaque équipe reçoit des valeurs attendues de buts basées "
      "sur ses <b>points FIFA officiels du 11 juin 2026</b> (veille du tournoi). "
      "Les 48 équipes qualifiées ont des ratings de 1 342 (Curaçao) à 1 877 (Argentine), "
      "pour une moyenne <i>avgFifa</i> ≈ 1 580."),
    SP(4),
    Code(
"priorGF_A  =  avgGF × (fifaA / avgFifa) ^ 1.5\n"
"priorGA_A  =  avgGA × (avgFifa / fifaA) ^ 1.5"
    ),
    SP(6),
    P("L'exposant <b>1.5</b> différencie suffisamment les équipes sans créer d'écart "
      "irréaliste. Exemples de prédictions en prior pur (aucun match joué) :"),
    SP(4),
    data_table([
        ["Confrontation",                          "λA",   "λB",   "P(Vic. A)"],
        ["Argentine (1877)  vs  Curaçao (1342)",   "2.05", "0.78", "~74 %"],
        ["France (1855)     vs  Brésil (1765)",    "1.65", "1.48", "~42 %"],
        ["Maroc (1750)      vs  Écosse (1490)",    "1.62", "1.05", "~58 %"],
        ["Mexique (1705)    vs  Haïti (1398)",     "1.74", "0.93", "~65 %"],
    ], [8.5*cm, 2.2*cm, 2.2*cm, 3.1*cm]),
    SP(8),
]

# ── 3. Régression bayésienne ───────────────────────────────────────────────────
story += [
    H1("3. Régression bayésienne (K = 6)"),
    P("Au fil des matchs joués, les statistiques réelles viennent progressivement remplacer "
      "le prior FIFA selon un schéma de mélange pondéré (Bayesian shrinkage) :"),
    SP(4),
    Code(
"w  =  matchs_joués / (matchs_joués + K)     avec K = 6\n\n"
"gf_A  =  w × rawGF_A  +  (1 - w) × priorGF_A\n"
"ga_A  =  w × rawGA_A  +  (1 - w) × priorGA_A"
    ),
    SP(6),
    data_table([
        ["Matchs joués",        "Poids stats réelles (w)", "Poids prior FIFA (1 - w)"],
        ["0  (avant tournoi)",  "0 %",                     "100 %"],
        ["1  (après J1)",       "14 %",                    "86 %"],
        ["2  (après J2)",       "25 %",                    "75 %"],
        ["3  (après J3)",       "33 %",                    "67 %"],
        ["6",                   "50 %",                    "50 %"],
    ], [6*cm, 5*cm, 5*cm]),
    SP(6),
    Note("K=6 évite qu'un J1 difficile (ex : Maroc 0-2 Brésil) écrase le prior d'une "
         "équipe classée top-10. Avec K=3 (version précédente), une seule défaite rendait "
         "l'Écosse favorite contre le Maroc — résultat incohérent avec le classement FIFA."),
    SP(6),
]

# ── 4. Calcul des λ ────────────────────────────────────────────────────────────
story += [
    H1("4. Calcul des λ (buts attendus)"),
    P("Les lambdas croisent l'efficacité offensive d'une équipe avec la faiblesse défensive "
      "de l'adversaire, normalisés par la moyenne du tournoi :"),
    SP(4),
    Code(
"avgGF  =  total_buts_marqués / total_matchs_joués\n"
"           (≈ 1.3 – 1.6 en phase de groupes)\n\n"
"λA  =  clip( gf_A × ga_B / avgGF ,  min=0.2,  max=4.0 )\n"
"λB  =  clip( gf_B × ga_A / avgGF ,  min=0.2,  max=4.0 )"
    ),
    SP(6),
    P("Le clip [0.2 ; 4.0] empêche des prédictions aberrantes lorsqu'une équipe n'a "
      "joué qu'un seul match (ex : 5 buts en J1 → λ serait irréaliste sans plafonnement)."),
    SP(6),
]

# ── 5. Distribution des scores ─────────────────────────────────────────────────
story += [
    H1("5. Distribution des scores (grille 8×8)"),
    P("On calcule la probabilité de chaque score exact (i, j) de (0,0) à (7,7), "
      "ce qui couvre plus de 99,9 % de la masse de probabilité :"),
    SP(4),
    Code(
"pour i de 0 à 7, j de 0 à 7 :\n"
"    P(i, j)  =  e^(-λA) × λA^i / i!   ×   e^(-λB) × λB^j / j!\n\n"
"P(Victoire A)  =  Σ P(i,j)   pour i > j\n"
"P(Nul)         =  Σ P(i,j)   pour i = j\n"
"P(Défaite A)   =  Σ P(i,j)   pour i < j"
    ),
    SP(6),
]

# ── 6. Argmax par catégorie ────────────────────────────────────────────────────
story += [
    H1("6. Score prédit — argmax par catégorie (correctif clé)"),
    P("Sans correctif, le score globalement le plus probable est toujours <b>1-1</b> "
      "car c'est le score le plus fréquent selon Poisson avec λ ≈ 1.3, même quand une "
      "équipe a 50% de chance de gagner. Le score prédit serait donc toujours nul."),
    P("La solution : chercher le score le plus probable <b>dans chaque catégorie "
      "séparément</b> (Victoire / Nul / Défaite), puis afficher le score de la catégorie "
      "dont la probabilité totale est la plus haute :"),
    SP(4),
    Code(
"bestW  =  argmax P(i,j)   pour i > j   → ex: 2-1\n"
"bestD  =  argmax P(i,j)   pour i = j   → ex: 1-1\n"
"bestL  =  argmax P(i,j)   pour i < j   → ex: 0-2\n\n"
"si P(Vic.A) ≥ P(Nul) et P(Vic.A) ≥ P(Déf.A)  →  afficher bestW\n"
"si P(Nul) est maximum                          →  afficher bestD\n"
"sinon                                          →  afficher bestL"
    ),
    SP(6),
    Note("Exemple : Maroc vs Écosse — P(V)=48%, P(N)=25%, P(D)=27%. "
         "Sans correctif → 1-1 affiché. "
         "Avec correctif → 1-0 affiché (meilleur score dans la catégorie Victoire)."),
    SP(6),
]

# ── 7. Filtre et affichage ─────────────────────────────────────────────────────
story += [
    H1("7. Filtre et affichage"),
    P("Les prédictions sont calculées uniquement pour les matchs à venir :"),
    SP(4),
    data_table([
        ["Condition",                                       "Traitement"],
        ["match.isFT = true  (terminé)",                   "Exclu — score réel affiché"],
        ["match.isLive = true  (en cours)",                "Exclu — score live affiché"],
        ["Placeholder KO  (\"1er Gr.A\", \"V M73\"…)",    "Exclu via regex _PRED_SKIP"],
        ["hasStats = true  (≥ 1 match joué par équipe)",   "Affiché en orange"],
        ["hasStats = false  (J1 pas encore joué)",         "Affiché en gris"],
    ], [9.5*cm, 6.5*cm]),
    SP(8),
]

# ── 8. Limites ─────────────────────────────────────────────────────────────────
story += [
    H1("8. Limites et pistes d'amélioration"),
    H2("Limites actuelles"),
    P("• <b>Indépendance des buts</b> : le modèle suppose que les buts de A et B sont "
      "indépendants, ce qui est une approximation (en réalité le score influence le jeu)."),
    P("• <b>K fixe</b> : K=6 constant signifie qu'en J3 (3 matchs joués), le prior FIFA "
      "domine encore à 67 %. Un K décroissant convergerait plus vite vers les stats réelles "
      "en fin de phase de groupes."),
    P("• <b>Pas de contexte</b> : blessures, suspensions, importance de la rencontre "
      "(déjà qualifié ?), terrain neutre vs effectif local, ne sont pas pris en compte."),
    P("• <b>Pas de côtes de paris</b> : les marchés bookmakers intègrent toutes ces "
      "informations contextuel les et constituent un signal fort."),
    H2("Pistes d'amélioration"),
    P("• <b>K adaptatif</b> : K = max(2, 6 − matchs_joués) pour converger plus vite "
      "vers les stats réelles en J3."),
    P("• <b>Côtes bookmakers</b> via The Odds API injectées comme prior supplémentaire."),
    P("• <b>xG (expected goals)</b> plutôt que buts réels pour les λ, moins sensible "
      "aux performances exceptionnelles d'un seul match."),
    SP(16),
    HR(),
    Paragraph("WC 2026 Dashboard  ·  Modèle Poisson v4  ·  Staging uniquement", footer_style),
]

doc.build(story)
print("PDF généré : docs/algo_predictions_v2.pdf")
