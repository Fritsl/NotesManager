# Row Level Security (RLS) Policies for Supabase

This document outlines the RLS policies that need to be implemented for the note-taking application to properly function with images.

## note_images Table

The following policies should be applied to the `note_images` table:

### 1. Select (Read) Policy

```sql
CREATE POLICY "Users can view their own note images" ON "note_images"
FOR SELECT
USING (
  note_id IN (
    SELECT id FROM notes WHERE user_id = auth.uid()
  )
);
```

This policy ensures users can only view image records related to notes they own.

### 2. Insert Policy

```sql
CREATE POLICY "Users can insert their own note images" ON "note_images"
FOR INSERT
WITH CHECK (
  note_id IN (
    SELECT id FROM notes WHERE user_id = auth.uid()
  )
);
```

This policy ensures users can only insert image records for notes they own.

### 3. Update Policy

```sql
CREATE POLICY "Users can update their own note images" ON "note_images"
FOR UPDATE
USING (
  note_id IN (
    SELECT id FROM notes WHERE user_id = auth.uid()
  )
);
```

This policy ensures users can only update image records for notes they own.

### 4. Delete Policy

```sql
CREATE POLICY "Users can delete their own note images" ON "note_images"
FOR DELETE
USING (
  note_id IN (
    SELECT id FROM notes WHERE user_id = auth.uid()
  )
);
```

This policy ensures users can only delete image records for notes they own.

## Storage Bucket Policies

For the `note-images` storage bucket, ensure the following:

### 1. Make the bucket public

This can be done from the Supabase dashboard:

1. Go to Storage > Buckets
2. Select the `note-images` bucket
3. Click on the "..." menu and select "Make public"

### 2. Set up CORS policies

In the Supabase dashboard:

1. Go to Storage > Policies
2. Add a CORS configuration like:

```json
{
  "cors": [
    {
      "allowedOrigins": ["*"],
      "allowedMethods": ["GET"],
      "allowedHeaders": ["Content-Type"],
      "maxAgeSeconds": 3600,
      "exposeHeaders": []
    }
  ]
}
```

This allows browsers to display images from any origin.

## Verify Policies

To verify RLS policies are working correctly:

1. Ensure the Supabase service role key is used for server operations
2. Ensure client-side operations use the appropriate user session
3. Test image uploads and retrieval with different user accounts

If images still don't display after implementing these policies, additional debugging may be needed.