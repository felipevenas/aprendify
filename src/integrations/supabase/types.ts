export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      friendships: {
        Row: {
          addressee_id: string
          blocked_by: string | null
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friend_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          is_online: boolean
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_challenges: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          creator_completed_at: string | null
          creator_id: string
          duration_minutes: number
          expires_at: string
          id: string
          invitee_completed_at: string | null
          invitee_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_completed_at?: string | null
          creator_id: string
          duration_minutes: number
          expires_at?: string
          id?: string
          invitee_completed_at?: string | null
          invitee_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_completed_at?: string | null
          creator_id?: string
          duration_minutes?: number
          expires_at?: string
          id?: string
          invitee_completed_at?: string | null
          invitee_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          id: string
          metadata: Json
          notification_type: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          notification_type: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: []
      }
      social_rate_limits: {
        Row: {
          action: string
          calls_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          action: string
          calls_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          action?: string
          calls_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          achievement_type: string
          created_at: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_type: string
          created_at?: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_type?: string
          created_at?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          calls_count: number
          created_at: string
          function_name: string
          id: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          calls_count?: number
          created_at?: string
          function_name: string
          id?: string
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          calls_count?: number
          created_at?: string
          function_name?: string
          id?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          redeemed_by: string
          subscription_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          redeemed_by: string
          subscription_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          redeemed_by?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "creator_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "creator_coupons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_coupon_history: {
        Row: {
          coupon_code: string
          created_at: string
          id: string
          reason: string | null
          revoked_at: string
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          coupon_code: string
          created_at: string
          id?: string
          reason?: string | null
          revoked_at?: string
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string
          created_at?: string
          id?: string
          reason?: string | null
          revoked_at?: string
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      creator_coupons: {
        Row: {
          coupon_code: string
          created_at: string
          id: string
          is_active: boolean
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enem_questions: {
        Row: {
          alternatives: Json
          alternatives_introduction: string | null
          classification_status: string | null
          confidence: number | null
          context: string | null
          correct_alternative: string
          created_at: string | null
          difficulty: string | null
          discipline: string
          files: string[] | null
          id: string
          index: number
          is_active: boolean
          language: string | null
          main_topic: string | null
          origin: string | null
          subtopics: string[] | null
          title: string
          year: string
        }
        Insert: {
          alternatives: Json
          alternatives_introduction?: string | null
          classification_status?: string | null
          confidence?: number | null
          context?: string | null
          correct_alternative: string
          created_at?: string | null
          difficulty?: string | null
          discipline: string
          files?: string[] | null
          id?: string
          index: number
          is_active?: boolean
          language?: string | null
          main_topic?: string | null
          origin?: string | null
          subtopics?: string[] | null
          title: string
          year: string
        }
        Update: {
          alternatives?: Json
          alternatives_introduction?: string | null
          classification_status?: string | null
          confidence?: number | null
          context?: string | null
          correct_alternative?: string
          created_at?: string | null
          difficulty?: string | null
          discipline?: string
          files?: string[] | null
          id?: string
          index?: number
          is_active?: boolean
          language?: string | null
          main_topic?: string | null
          origin?: string | null
          subtopics?: string[] | null
          title?: string
          year?: string
        }
        Relationships: []
      }
      essays: {
        Row: {
          content: string
          created_at: string
          feedback: string | null
          id: string
          score_competency_1: number | null
          score_competency_2: number | null
          score_competency_3: number | null
          score_competency_4: number | null
          score_competency_5: number | null
          score_total: number | null
          status: string
          tips: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          feedback?: string | null
          id?: string
          score_competency_1?: number | null
          score_competency_2?: number | null
          score_competency_3?: number | null
          score_competency_4?: number | null
          score_competency_5?: number | null
          score_total?: number | null
          status?: string
          tips?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          feedback?: string | null
          id?: string
          score_competency_1?: number | null
          score_competency_2?: number | null
          score_competency_3?: number | null
          score_competency_4?: number | null
          score_competency_5?: number | null
          score_total?: number | null
          status?: string
          tips?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_tickets: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          status: string
          ticket_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          status?: string
          ticket_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          status?: string
          ticket_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back_content: string
          created_at: string
          front_content: string
          id: string
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          back_content: string
          created_at?: string
          front_content: string
          id?: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          back_content?: string
          created_at?: string
          front_content?: string
          id?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leaderboard_stats: {
        Row: {
          created_at: string
          id: string
          points: number
          questions_answered: number
          questions_correct: number
          streak_days: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: number
          questions_answered?: number
          questions_correct?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          questions_answered?: number
          questions_correct?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "system_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "system_notifications_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birthdate: string | null
          created_at: string
          daily_question_goal: number | null
          email: string
          full_name: string | null
          id: string
          show_online_status: boolean
          onboarding_completed: boolean | null
          primeiro_acesso: boolean
          tempo_estudo: string | null
          media_atual: string | null
          curso_pretendido: string | null
          faculdade_desejada: string | null
          maiores_dificuldades: string[] | null
          city: string | null
          state: string | null
          current_situation: string | null
          main_goal: string | null
          study_preference: string | null
          signup_source: string | null
          accepts_marketing: boolean
          phone: string | null
          target_exam_year: string | null
          updated_at: string
          username: string | null
          weak_subjects: string[] | null
        }
        Insert: {
          birthdate?: string | null
          created_at?: string
          daily_question_goal?: number | null
          email: string
          full_name?: string | null
          id: string
          show_online_status?: boolean
          onboarding_completed?: boolean | null
          primeiro_acesso?: boolean
          tempo_estudo?: string | null
          media_atual?: string | null
          curso_pretendido?: string | null
          faculdade_desejada?: string | null
          maiores_dificuldades?: string[] | null
          city?: string | null
          state?: string | null
          current_situation?: string | null
          main_goal?: string | null
          study_preference?: string | null
          signup_source?: string | null
          accepts_marketing?: boolean
          phone?: string | null
          target_exam_year?: string | null
          updated_at?: string
          username?: string | null
          weak_subjects?: string[] | null
        }
        Update: {
          birthdate?: string | null
          created_at?: string
          daily_question_goal?: number | null
          email?: string
          full_name?: string | null
          id?: string
          show_online_status?: boolean
          onboarding_completed?: boolean | null
          primeiro_acesso?: boolean
          tempo_estudo?: string | null
          media_atual?: string | null
          curso_pretendido?: string | null
          faculdade_desejada?: string | null
          maiores_dificuldades?: string[] | null
          city?: string | null
          state?: string | null
          current_situation?: string | null
          main_goal?: string | null
          study_preference?: string | null
          signup_source?: string | null
          accepts_marketing?: boolean
          phone?: string | null
          target_exam_year?: string | null
          updated_at?: string
          username?: string | null
          weak_subjects?: string[] | null
        }
        Relationships: []
      }
      question_attempts: {
        Row: {
          correct_answer: string
          created_at: string
          discipline: string
          had_doubt: boolean | null
          id: string
          is_correct: boolean
          language: string | null
          question_id: string
          selected_answer: string
          topic: string | null
          user_id: string
          year: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          discipline: string
          had_doubt?: boolean | null
          id?: string
          is_correct: boolean
          language?: string | null
          question_id: string
          selected_answer: string
          topic?: string | null
          user_id: string
          year: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          discipline?: string
          had_doubt?: boolean | null
          id?: string
          is_correct?: boolean
          language?: string | null
          question_id?: string
          selected_answer?: string
          topic?: string | null
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer: string | null
          created_at: string
          difficulty: string | null
          id: string
          notes: string | null
          question_type: string
          solved: boolean
          statement: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          notes?: string | null
          question_type: string
          solved?: boolean
          statement: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          notes?: string | null
          question_type?: string
          solved?: boolean
          statement?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_generations: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          last_forced_at: string | null
          next_regeneration_at: string
          performance_snapshot: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          last_forced_at?: string | null
          next_regeneration_at?: string
          performance_snapshot?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          last_forced_at?: string | null
          next_regeneration_at?: string
          performance_snapshot?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      schedule_items: {
        Row: {
          activities: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          day_of_week: number
          end_time: string
          estimated_duration: number | null
          id: string
          is_ai_generated: boolean | null
          notes: string | null
          priority: string | null
          scheduled_date: string | null
          start_time: string
          study_tips: string | null
          subject_id: string | null
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activities?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          estimated_duration?: number | null
          id?: string
          is_ai_generated?: boolean | null
          notes?: string | null
          priority?: string | null
          scheduled_date?: string | null
          start_time: string
          study_tips?: string | null
          subject_id?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activities?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          estimated_duration?: number | null
          id?: string
          is_ai_generated?: boolean | null
          notes?: string | null
          priority?: string | null
          scheduled_date?: string | null
          start_time?: string
          study_tips?: string | null
          subject_id?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_answers: {
        Row: {
          answered_at: string | null
          correct_answer: string
          created_at: string
          discipline: string
          id: string
          is_correct: boolean | null
          question_id: string
          question_index: number
          selected_answer: string | null
          simulado_id: string
        }
        Insert: {
          answered_at?: string | null
          correct_answer: string
          created_at?: string
          discipline: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          question_index: number
          selected_answer?: string | null
          simulado_id: string
        }
        Update: {
          answered_at?: string | null
          correct_answer?: string
          created_at?: string
          discipline?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          question_index?: number
          selected_answer?: string | null
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_answers_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_results: {
        Row: {
          created_at: string
          id: string
          simulado_id: string
          strengths: Json | null
          tips: string | null
          total_correct: number
          total_incorrect: number
          total_unanswered: number
          weaknesses: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          simulado_id: string
          strengths?: Json | null
          tips?: string | null
          total_correct?: number
          total_incorrect?: number
          total_unanswered?: number
          weaknesses?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          simulado_id?: string
          strengths?: Json | null
          tips?: string | null
          total_correct?: number
          total_incorrect?: number
          total_unanswered?: number
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "simulado_results_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: true
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulados: {
        Row: {
          created_at: string
          duration_minutes: number
          essay_topic: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          total_questions: number
          type: string
          updated_at: string
          user_id: string
          year: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          essay_topic?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_questions?: number
          type: string
          updated_at?: string
          user_id: string
          year?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          essay_topic?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          total_questions?: number
          type?: string
          updated_at?: string
          user_id?: string
          year?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          plan_id: string | null
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          start_date: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          start_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          start_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          notification_type: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          notification_type?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          notification_type?: string
          title?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_progress: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          current_value: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          questions_today: number
          streak_completed_today: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          questions_today?: number
          streak_completed_today?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          questions_today?: number
          streak_completed_today?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          description: string
          discipline: string | null
          end_date: string
          id: string
          is_active: boolean
          reward_points: number
          start_date: string
          target_value: number
          title: string
        }
        Insert: {
          challenge_type?: string
          created_at?: string
          description: string
          discipline?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          reward_points?: number
          start_date: string
          target_value?: number
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string
          discipline?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          reward_points?: number
          start_date?: string
          target_value?: number
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      creator_coupons_public: {
        Row: {
          coupon_code: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
        }
        Relationships: []
      }
      system_notifications_public: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          notification_type: string | null
          title: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          notification_type?: string | null
          title?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          notification_type?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      social_search_users: {
        Args: { _query: string }
        Returns: { id: string; username: string | null; full_name: string | null }[]
      }
      social_list_friends: {
        Args: Record<PropertyKey, never>
        Returns: {
          friendship_id: string
          user_id: string
          username: string | null
          full_name: string | null
          is_online: boolean
          created_at: string
        }[]
      }
      social_list_requests: {
        Args: { _incoming?: boolean }
        Returns: {
          friendship_id: string
          user_id: string
          username: string | null
          full_name: string | null
          created_at: string
        }[]
      }
      social_send_friend_request: { Args: { _target_user_id: string }; Returns: string }
      social_respond_friend_request: { Args: { _friendship_id: string; _accept: boolean }; Returns: string }
      social_cancel_friend_request: { Args: { _friendship_id: string }; Returns: boolean }
      social_remove_friend: { Args: { _friendship_id: string }; Returns: boolean }
      social_block_user: { Args: { _target_user_id: string }; Returns: string }
      social_list_messages: {
        Args: { _friend_id: string }
        Returns: Database["public"]["Tables"]["friend_messages"]["Row"][]
      }
      social_send_message: {
        Args: { _recipient_id: string; _body: string }
        Returns: Database["public"]["Tables"]["friend_messages"]["Row"]
      }
      social_mark_messages_read: { Args: { _friend_id: string }; Returns: number }
      social_set_presence: {
        Args: { _is_online: boolean }
        Returns: Database["public"]["Tables"]["user_presence"]["Row"]
      }
      social_create_focus_challenge: {
        Args: { _friend_id: string; _duration_minutes: number }
        Returns: Database["public"]["Tables"]["focus_challenges"]["Row"]
      }
      social_get_focus_challenge: {
        Args: { _challenge_id: string }
        Returns: {
          id: string
          creator_id: string
          invitee_id: string
          duration_minutes: number
          status: string
          creator_completed_at: string | null
          invitee_completed_at: string | null
          accepted_at: string | null
          started_at: string | null
          completed_at: string | null
          expires_at: string
          created_at: string
          creator_name: string
          invitee_name: string
        }[]
      }
      social_update_focus_challenge: {
        Args: { _challenge_id: string; _action: string }
        Returns: Database["public"]["Tables"]["focus_challenges"]["Row"]
      }
      social_list_notifications: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          actor_id: string | null
          actor_name: string
          notification_type: string
          entity_id: string | null
          metadata: Json
          read_at: string | null
          created_at: string
        }[]
      }
      social_mark_notification_read: { Args: { _notification_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _function_name: string
          _max_calls?: number
          _user_id: string
          _window_minutes?: number
        }
        Returns: boolean
      }
      get_current_week_start: { Args: never; Returns: string }
      get_daily_question_count: { Args: { _user_id: string }; Returns: number }
      get_monthly_essay_count: { Args: { _user_id: string }; Returns: number }
      get_user_flashcard_count: { Args: { _user_id: string }; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_premium: { Args: { _user_id: string }; Returns: boolean }
      record_question_attempt: {
        Args: { _question_id: string; _selected_answer: string }
        Returns: string
      }
      resolve_login_email: { Args: { _username: string }; Returns: string }
      unlock_achievement: {
        Args: { _achievement_type: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      plan_type: "monthly" | "annual" | "god" | "creator"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      plan_type: ["monthly", "annual", "god", "creator"],
      user_role: ["admin", "user"],
    },
  },
} as const
