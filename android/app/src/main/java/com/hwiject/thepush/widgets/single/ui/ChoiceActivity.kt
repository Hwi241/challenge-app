package com.hwiject.thepush.widgets.single.ui

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import android.widget.TextView
import com.hwiject.thepush.R

class ChoiceActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_ThePush_Transparent)
        super.onCreate(savedInstanceState)
        window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)
        setContentView(R.layout.activity_choice_sheet)

        val challengeId = intent.getStringExtra("challengeId") ?: ""

        findViewById<TextView>(R.id.actionUpload).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW).setData(android.net.Uri.parse("thepush://upload?challengeId=$challengeId")))
            finish()
        }
        findViewById<TextView>(R.id.actionDashboard).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW).setData(android.net.Uri.parse("thepush://dashboard?challengeId=$challengeId")))
            finish()
        }
        findViewById<TextView>(R.id.actionCancel).setOnClickListener { finish() }
    }
}
