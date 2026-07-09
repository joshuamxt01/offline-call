package app.nexa.di

import android.content.Context
import androidx.room.Room
import app.nexa.data.local.ContactDao
import app.nexa.data.local.ConversationDao
import app.nexa.data.local.MessageDao
import app.nexa.data.local.NexaDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): NexaDatabase =
        Room.databaseBuilder(context, NexaDatabase::class.java, "nexa.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideMessageDao(db: NexaDatabase): MessageDao = db.messageDao()
    @Provides fun provideConversationDao(db: NexaDatabase): ConversationDao = db.conversationDao()
    @Provides fun provideContactDao(db: NexaDatabase): ContactDao = db.contactDao()
}
