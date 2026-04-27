import pandas as pd

_DISPOSABLE_DOMAINS = {
    "mailinator.com","tempmail.com","guerrillamail.com","10minutemail.com","throwaway.email",
    "yopmail.com","trashmail.com","sharklasers.com","guerrillamailblock.com","grr.la",
    "guerrillamail.info","guerrillamail.biz","guerrillamail.de","guerrillamail.net",
    "guerrillamail.org","spam4.me","dispostable.com","maildrop.cc","mailnull.com",
    "spamgourmet.com","spamgourmet.net","spamgourmet.org","trashmail.at","trashmail.io",
    "trashmail.me","trashmail.net","trashmail.xyz","getairmail.com","fakeinbox.com",
    "mailexpire.com","spamfree24.org","spamfree24.de","spamfree24.net","spamfree24.info",
    "spamfree24.eu","spamfree.eu","spamfree24.com","tempinbox.com","tempinbox.co.uk",
    "throwam.com","mailmetrash.com","spammotel.com","incognitomail.org","incognitomail.com",
    "incognitomail.net","mailscrap.com","tempmail.net","tempr.email","tempemail.net",
    "mailnew.com","e4ward.com","mytrashmail.com","mt2014.com","mt2015.com","filzmail.com",
    "throwam.com","discard.email","mailboxy.fun","inboxbear.com","spamhereplease.com",
    "binkmail.com","haltospam.com","spamevader.com","jetable.fr.nf","jetable.net",
    "jetable.org","nomail.xl.cx","sogetthis.com","uggsrock.com","spamfree.eu",
    "dodgit.com","objectmail.com","spaml.de","spam.la","spamherelots.com",
    "spamhereplease.com","spaml.com","mailzilla.com","mailzilla.org","mailzilla.net",
    "0-mail.com","0815.ru","0815.su","0clickemail.com","0wnd.net","0wnd.org",
    "10mail.org","10minutemail.net","10minutemail.org","123-m.com","1fsdfdsfsdf.tk",
    "20mail.it","20minutemail.com","21cn.com","2fdgdfgdfgdf.tk","33mail.com",
    "3d-painting.com","4warding.com","5ymail.com","6mail.cf","6mail.ga","6mail.ml",
    "6paq.com","7tags.com","anonaddy.com","anonbox.net","anonymail.dk","anonymousemail.me",
    "spam.2012-2016.ru","crazymailing.com","deadaddress.com","deadletter.ga",
    "despam.it","devnullmail.com","discard.email","discardmail.com","discardmail.de",
    "disposableaddress.com","disposableemailaddresses.com","disposableinbox.com",
    "disposeamail.com","dispostable.com","dm.w3internet.co.uk","domozmail.com",
    "donemail.ru","dontreg.com","dontsendmespam.de","drdrb.net","dump-email.info",
    "dumpandfuck.com","dumpmail.de","dumpyemail.com","email60.com","emailias.com",
    "emailinfive.com","emailmiser.com","emailsensei.com","emailtemporanea.com",
    "emailtemporario.com.br","emailto.de","emailwarden.com","emailxfer.com",
    "emkei.ga","emkei.gq","emkei.ml","emkei.cf","emkei.tk","eml.pp.ua",
    "emz.net","enterto.com","ephemail.net","etranquil.com","etranquil.net",
    "etranquil.org","explodemail.com","express.net.ua","extremail.ru","eyepaste.com",
    "fakemailgenerator.com","fastacura.com","fastchevy.com","fastchrysler.com",
    "fastkawasaki.com","fastmazda.com","fastmitsubishi.com","fastnissan.com",
    "fastsubaru.com","fastsuzuki.com","fasttoyota.com","fastyamaha.com",
    "fightallspam.com","fiifke.de","filzmail.com","fivemail.de","fixmail.tk",
    "fizmail.com","fleckens.hu","frapmail.com","front14.org","frustratethespam.com",
    "fudgerub.com","fux0ringduh.com","garliclife.com","gehensiemirnichtaufdengeist.de",
    "get2mail.fr","getairmail.com","getonemail.com","getonemail.net","ghosttexter.de",
    "girlsundertheinfluence.com","gishpuppy.com","goemailgo.com","gotmail.net",
    "gotmail.org","gowikibooks.com","gowikicampus.com","gowikipedia.org",
    "grr.la","gsrv.co.uk","gustr.com","h.mintemail.com","hailmail.net",
    "hatespam.org","herp.in","hidemail.de","hidzz.com","hochsitze.com",
    "hocinemail.com","hopemail.biz","hulapla.de","hunglam.com","humaility.com",
    "ieatspam.eu","ieatspam.info","ieh-mail.de","ikbenspamvrij.nl","ilovedirtemail.com",
    "imails.info","inbax.tk","inbox.si","inboxclean.com","inboxclean.org",
    "insorg.org","instant-mail.de","instantemailaddress.com","internet.kg",
    "iodizc.com","ipoo.org","irish2me.com","iwi.net",
}


def check_disposable_email(
    df: pd.DataFrame,
    email_column: str,
) -> tuple:
    if email_column not in df.columns:
        return df, {"status": "error", "message": f"Column '{email_column}' not found"}

    new_col = "comments_email_temp_mail_check"

    def _is_disposable(val):
        if pd.isna(val) or not str(val).strip():
            return False
        email = str(val).strip().lower()
        if "@" not in email:
            return False
        domain = email.split("@")[-1]
        return domain in _DISPOSABLE_DOMAINS

    results = df[email_column].apply(_is_disposable)

    idx = df.columns.get_loc(email_column) + 1
    df.insert(idx, new_col, results)

    return df, {
        "status": "success",
        "column_created": new_col,
        "disposable_found": int(results.sum()),
        "rows_processed": len(df),
    }
