import pandas as pd

_VALID_TLDS = {
    # Generic
    "com","net","org","edu","gov","mil","int","info","biz","name","pro","aero","coop","museum",
    # New gTLDs (common)
    "academy","accountant","accountants","actor","adult","agency","airforce","apartments","app",
    "art","associates","auction","audio","auto","bank","bar","bargains","beauty","beer","best",
    "bid","bike","bingo","black","blog","blue","boutique","broker","build","builders","business",
    "cab","cafe","camera","camp","capital","care","careers","cash","casino","catering","center",
    "ceo","chat","cheap","church","city","claims","cleaning","click","clinic","clothing","cloud",
    "club","co","coach","codes","coffee","college","community","company","computer","construction",
    "consulting","contact","cool","coupons","credit","creditcard","cruises","dance","date","dating",
    "deals","degree","delivery","democrat","design","dev","digital","direct","directory","discount",
    "doctor","dog","domains","education","email","energy","engineer","engineering","enterprises",
    "equipment","estate","events","exchange","expert","exposed","express","fail","farm","finance",
    "financial","fish","fitness","flights","florist","football","foundation","fund","furniture",
    "gallery","gift","gifts","gives","glass","global","gold","golf","graphics","green","group",
    "guide","guru","health","hockey","holdings","holiday","homes","horse","hospital","house",
    "immo","immobilien","industries","ink","institute","insurance","investments","io","jewelry",
    "kitchen","land","law","lease","legal","life","lighting","limited","limo","link","live",
    "llc","loan","loans","lol","maison","management","marketing","media","memorial","money",
    "mortgage","movie","network","news","ninja","online","partners","parts","photography","photos",
    "pictures","pink","pizza","place","plumbing","plus","press","productions","properties",
    "property","realty","recipes","red","rehab","rent","rentals","repair","report","republican",
    "restaurant","review","reviews","rip","rocks","sale","salon","school","services","shoes",
    "show","singles","social","solar","solutions","space","studio","style","supplies","supply",
    "support","systems","tax","taxi","tech","technology","tips","today","tools","tours","trade",
    "training","tv","university","vacations","ventures","video","vision","voyage","watch",
    "website","wiki","works","world","wtf","yoga","zone",
    # ccTLDs
    "ac","ad","ae","af","ag","ai","al","am","ao","aq","ar","as","at","au","aw","ax","az",
    "ba","bb","bd","be","bf","bg","bh","bi","bj","bm","bn","bo","br","bs","bt","bv","bw",
    "by","bz","ca","cc","cd","cf","cg","ch","ci","ck","cl","cm","cn","co","cr","cu","cv",
    "cw","cx","cy","cz","de","dj","dk","dm","do","dz","ec","ee","eg","er","es","et","eu",
    "fi","fj","fk","fm","fo","fr","ga","gb","gd","ge","gf","gg","gh","gi","gl","gm","gn",
    "gp","gq","gr","gs","gt","gu","gw","gy","hk","hm","hn","hr","ht","hu","id","ie","il",
    "im","in","io","iq","ir","is","it","je","jm","jo","jp","ke","kg","kh","ki","km","kn",
    "kp","kr","kw","ky","kz","la","lb","lc","li","lk","lr","ls","lt","lu","lv","ly","ma",
    "mc","md","me","mg","mh","mk","ml","mm","mn","mo","mp","mq","mr","ms","mt","mu","mv",
    "mw","mx","my","mz","na","nc","ne","nf","ng","ni","nl","no","np","nr","nu","nz","om",
    "pa","pe","pf","pg","ph","pk","pl","pm","pn","pr","ps","pt","pw","py","qa","re","ro",
    "rs","ru","rw","sa","sb","sc","sd","se","sg","sh","si","sj","sk","sl","sm","sn","so",
    "sr","ss","st","sv","sx","sy","sz","tc","td","tf","tg","th","tj","tk","tl","tm","tn",
    "to","tr","tt","tv","tw","tz","ua","ug","uk","us","uy","uz","va","vc","ve","vg","vi",
    "vn","vu","wf","ws","ye","yt","za","zm","zw",
}


def check_email_tld(
    df: pd.DataFrame,
    email_column: str | None,
) -> tuple:
    new_col = "comments_email_valid_tld"

    if not email_column or email_column not in df.columns:
        df[new_col] = "Not Valid"
        return df, {"status": "success", "column_created": new_col,
                    "valid_tld": 0, "invalid_tld": len(df), "rows_processed": len(df),
                    "note": "email column not mapped"}

    def _check(val):
        if pd.isna(val) or not str(val).strip():
            return "Not Valid"
        email = str(val).strip().lower()
        if "@" not in email:
            return "Not Valid"
        domain = email.split("@")[-1]
        if "." not in domain:
            return "Not Valid"
        tld = domain.rsplit(".", 1)[-1]
        return "Valid" if tld in _VALID_TLDS else "Not Valid"

    results = df[email_column].apply(_check)

    idx = df.columns.get_loc(email_column) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "valid_tld": int((results == "Valid").sum()),
        "invalid_tld": int((results == "Not Valid").sum()),
        "rows_processed": len(df),
    }
