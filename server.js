const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

/* =========================================================
   APP
========================================================= */

const app = express();

app.use(cors());
app.use(express.json());

/* Serve public folder */
app.use(express.static(path.join(__dirname, "public")));


/* =========================================================
   SUPABASE
========================================================= */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log("SUPABASE URL:", supabaseUrl ? "FOUND" : "NOT FOUND");
console.log("SUPABASE KEY:", supabaseKey ? "FOUND" : "NOT FOUND");

if (!supabaseUrl) {
  console.error("ERROR: SUPABASE_URL is missing from .env");
  process.exit(1);
}

if (!supabaseKey) {
  console.error("ERROR: SUPABASE_ANON_KEY is missing from .env");
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);


/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});


/* =========================================================
   DATABASE TEST
========================================================= */

app.get("/api/database-test", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("players")
      .select(
        "id, username, display_name, avatar_url, online, last_seen"
      )
      .order("id", {
        ascending: true
      });

    if (error) {
      console.error("Supabase error:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "FFArena database connected successfully!",
      players: data
    });

  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   PLAYERS
========================================================= */

/* Get all players */

app.get("/api/players", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("players")
      .select(
        "id, username, display_name, avatar_url, online, last_seen, wins, losses"
      )
      .order("username", {
        ascending: true
      });

    if (error) {
      console.error("Players error:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      players: data
    });

  } catch (error) {
    console.error("Players error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   GET ONE PLAYER
========================================================= */

app.get("/api/players/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid player ID."
      });
    }

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: "Player not found."
      });
    }

    res.json({
      success: true,
      player: data
    });

  } catch (error) {
    console.error("Player error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   CHAT - GET MESSAGES
========================================================= */

app.get("/api/messages", async (req, res) => {
  try {
    const senderId = Number(req.query.sender_id);
    const receiverId = Number(req.query.receiver_id);

    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        error: "sender_id and receiver_id are required."
      });
    }

    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        sender_id,
        receiver_id,
        message,
        created_at
      `)
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`
      )
      .order("created_at", {
        ascending: true
      });

    if (error) {
      console.error("Message loading error:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      messages: data
    });

  } catch (error) {
    console.error("Message error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   CHAT - SEND MESSAGE
========================================================= */

app.post("/api/messages", async (req, res) => {
  try {
    const senderId = Number(req.body.sender_id);
    const receiverId = Number(req.body.receiver_id);
    const cleanMessage = String(
      req.body.message || ""
    ).trim();

    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        error: "Sender and receiver are required."
      });
    }

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        error: "Message cannot be empty."
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        error: "You cannot message yourself."
      });
    }

    /* Check sender */

    const {
      data: sender,
      error: senderError
    } = await supabase
      .from("players")
      .select("id")
      .eq("id", senderId)
      .single();

    if (senderError || !sender) {
      return res.status(400).json({
        success: false,
        error: "Sender player does not exist."
      });
    }

    /* Check receiver */

    const {
      data: receiver,
      error: receiverError
    } = await supabase
      .from("players")
      .select("id")
      .eq("id", receiverId)
      .single();

    if (receiverError || !receiver) {
      return res.status(400).json({
        success: false,
        error: "Receiver player does not exist."
      });
    }

    /* Insert message */

    const {
      data,
      error
    } = await supabase
      .from("messages")
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message: cleanMessage
      })
      .select()
      .single();

    if (error) {
      console.error("Send message error:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: data
    });

  } catch (error) {
    console.error("Send message error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   TEAMS - GET
========================================================= */

app.get("/api/teams", async (req, res) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        tag,
        owner_id,
        wins,
        losses,
        created_at,
        updated_at
      `)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error("Teams error:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      teams: data
    });

  } catch (error) {
    console.error("Teams error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   TEAMS - CREATE
========================================================= */

app.post("/api/teams", async (req, res) => {
  try {
    const cleanName = String(
      req.body.name || ""
    ).trim();

    const cleanTag = String(
      req.body.tag || ""
    )
      .trim()
      .toUpperCase();

    const ownerId = Number(
      req.body.owner_id
    );

    if (!cleanName || !cleanTag || !ownerId) {
      return res.status(400).json({
        success: false,
        error:
          "Team name, tag and owner are required."
      });
    }

    /* Make sure owner exists */

    const {
      data: owner,
      error: ownerError
    } = await supabase
      .from("players")
      .select("id")
      .eq("id", ownerId)
      .single();

    if (ownerError || !owner) {
      return res.status(400).json({
        success: false,
        error: "Owner player does not exist."
      });
    }

    /* Create team */

    const {
      data,
      error
    } = await supabase
      .from("teams")
      .insert({
        name: cleanName,
        tag: cleanTag,
        owner_id: ownerId
      })
      .select()
      .single();

    if (error) {
      console.error("Create team error:", error);

      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    /* Add owner to team_members */

    const {
      error: memberError
    } = await supabase
      .from("team_members")
      .insert({
        team_id: data.id,
        player_id: ownerId
      });

    if (memberError) {
      console.error(
        "Team member error:",
        memberError
      );
    }

    res.status(201).json({
      success: true,
      team: data
    });

  } catch (error) {
    console.error("Create team error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   TEAM MEMBERS - GET
========================================================= */

app.get(
  "/api/teams/:id/members",
  async (req, res) => {

    try {
      const teamId = Number(
        req.params.id
      );

      if (!teamId) {
        return res.status(400).json({
          success: false,
          error: "Invalid team ID."
        });
      }

      const {
        data,
        error
      } = await supabase
        .from("team_members")
        .select(`
          id,
          team_id,
          player_id,
          joined_at,
          players (
            id,
            username,
            display_name,
            avatar_url,
            online
          )
        `)
        .eq("team_id", teamId)
        .order("joined_at", {
          ascending: true
        });

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      res.json({
        success: true,
        members: data
      });

    } catch (error) {
      console.error(
        "Team members error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);


/* =========================================================
   MATCHES - GET ALL
========================================================= */

app.get("/api/matches", async (req, res) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error("Matches error:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      matches: data
    });

  } catch (error) {
    console.error("Matches error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   MATCHES - GET ONE
========================================================= */

app.get(
  "/api/matches/:id",
  async (req, res) => {

    try {
      const matchId = Number(
        req.params.id
      );

      if (!matchId) {
        return res.status(400).json({
          success: false,
          error: "Invalid match ID."
        });
      }

      const {
        data: match,
        error
      } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (error || !match) {
        return res.status(404).json({
          success: false,
          error: "Match not found."
        });
      }

      const {
        data: players,
        error: playersError
      } = await supabase
        .from("match_players")
        .select(`
          id,
          match_id,
          player_id,
          team,
          status,
          joined_at,
          players (
            id,
            username,
            display_name,
            avatar_url,
            online
          )
        `)
        .eq("match_id", matchId)
        .order("joined_at", {
          ascending: true
        });

      if (playersError) {
        return res.status(500).json({
          success: false,
          error: playersError.message
        });
      }

      res.json({
        success: true,
        match,
        players
      });

    } catch (error) {
      console.error(
        "Get match error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);


/* =========================================================
   CREATE MATCH
========================================================= */

app.post(
  "/api/matches",
  async (req, res) => {

    try {

      const name = String(
        req.body.name || ""
      ).trim();

      const format = String(
        req.body.format || ""
      ).trim();

      const creatorId = Number(
        req.body.creator_id
      );

      const entryCoins = Math.max(
        0,
        Number(req.body.entry_coins) || 0
      );

      if (!name || !format || !creatorId) {
        return res.status(400).json({
          success: false,
          error:
            "Match name, format and creator are required."
        });
      }

      const validFormats = [
        "1v1",
        "2v2",
        "2v3",
        "3v3",
        "4v4",
        "5v5",
        "custom"
      ];

      if (!validFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          error: "Invalid match format."
        });
      }

      /* Check creator */

      const {
        data: creator,
        error: creatorError
      } = await supabase
        .from("players")
        .select("id")
        .eq("id", creatorId)
        .single();

      if (creatorError || !creator) {
        return res.status(400).json({
          success: false,
          error: "Creator player does not exist."
        });
      }

      /* Determine team sizes */

      let teamASize;
      let teamBSize;

      if (format === "custom") {

        teamASize = Number(
          req.body.team_a_size
        ) || 5;

        teamBSize = Number(
          req.body.team_b_size
        ) || 5;

      } else {

        const sizes = format
          .split("v")
          .map(Number);

        teamASize = sizes[0];
        teamBSize = sizes[1];

      }

      if (
        teamASize < 1 ||
        teamBSize < 1
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Team sizes must be at least 1."
        });
      }

      const maxPlayers =
        teamASize + teamBSize;

      /* Create match */

      const {
        data: match,
        error
      } = await supabase
        .from("matches")
        .insert({
          name,
          format,
          creator_id: creatorId,
          entry_coins: entryCoins,
          status: "OPEN",
          max_players: maxPlayers,
          team_a_size: teamASize,
          team_b_size: teamBSize
        })
        .select()
        .single();

      if (error) {
        console.error(
          "Create match error:",
          error
        );

        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      /* Automatically add creator */

      const {
        error: playerError
      } = await supabase
        .from("match_players")
        .insert({
          match_id: match.id,
          player_id: creatorId,
          team: "A",
          status: "ALIVE"
        });

      if (playerError) {
        console.error(
          "Add creator to match error:",
          playerError
        );

        return res.status(500).json({
          success: false,
          error: playerError.message
        });
      }

      res.status(201).json({
        success: true,
        match
      });

    } catch (error) {

      console.error(
        "Create match error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });

    }

  }
);


/* =========================================================
   JOIN MATCH
========================================================= */

app.post(
  "/api/matches/:id/join",
  async (req, res) => {

    try {

      const matchId = Number(
        req.params.id
      );

      const playerId = Number(
        req.body.player_id
      );

      if (!matchId || !playerId) {
        return res.status(400).json({
          success: false,
          error:
            "Match ID and player ID are required."
        });
      }

      /* Get match */

      const {
        data: match,
        error: matchError
      } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        return res.status(404).json({
          success: false,
          error: "Match not found."
        });
      }

      if (match.status !== "OPEN") {
        return res.status(400).json({
          success: false,
          error:
            "This match is no longer accepting players."
        });
      }

      /* Check player */

      const {
        data: player,
        error: playerError
      } = await supabase
        .from("players")
        .select("id")
        .eq("id", playerId)
        .single();

      if (playerError || !player) {
        return res.status(400).json({
          success: false,
          error: "Player does not exist."
        });
      }

      /* Check existing membership */

      const {
        data: existingPlayer
      } = await supabase
        .from("match_players")
        .select("id")
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (existingPlayer) {
        return res.status(400).json({
          success: false,
          error:
            "You are already in this match."
        });
      }

      /* Get current players */

      const {
        data: players,
        error: playersError
      } = await supabase
        .from("match_players")
        .select("*")
        .eq("match_id", matchId);

      if (playersError) {
        return res.status(500).json({
          success: false,
          error: playersError.message
        });
      }

      if (
        players.length >=
        match.max_players
      ) {
        return res.status(400).json({
          success: false,
          error: "This match is full."
        });
      }

      /* Count teams */

      const teamAPlayers =
        players.filter(
          player => player.team === "A"
        ).length;

      const teamBPlayers =
        players.filter(
          player => player.team === "B"
        ).length;

      let team;

      if (
        teamAPlayers <
        match.team_a_size
      ) {

        team = "A";

      } else if (
        teamBPlayers <
        match.team_b_size
      ) {

        team = "B";

      } else {

        return res.status(400).json({
          success: false,
          error:
            "There are no available team slots."
        });

      }

      /* Add player */

      const {
        data: joinedPlayer,
        error: joinError
      } = await supabase
        .from("match_players")
        .insert({
          match_id: matchId,
          player_id: playerId,
          team,
          status: "ALIVE"
        })
        .select()
        .single();

      if (joinError) {
        return res.status(400).json({
          success: false,
          error: joinError.message
        });
      }

      /* Update status if full */

      const newPlayerCount =
        players.length + 1;

      if (
        newPlayerCount >=
        match.max_players
      ) {

        await supabase
          .from("matches")
          .update({
            status: "FULL"
          })
          .eq("id", matchId);

      }

      res.status(201).json({
        success: true,
        player: joinedPlayer
      });

    } catch (error) {

      console.error(
        "Join match error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });

    }

  }
);


/* =========================================================
   START MATCH
========================================================= */

app.post(
  "/api/matches/:id/start",
  async (req, res) => {

    try {

      const matchId = Number(
        req.params.id
      );

      if (!matchId) {
        return res.status(400).json({
          success: false,
          error: "Invalid match ID."
        });
      }

      /* Get match */

      const {
        data: match,
        error: matchError
      } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        return res.status(404).json({
          success: false,
          error: "Match not found."
        });
      }

      if (match.status === "LIVE") {
        return res.status(400).json({
          success: false,
          error:
            "This match has already started."
        });
      }

      if (match.status === "FINISHED") {
        return res.status(400).json({
          success: false,
          error:
            "This match has already finished."
        });
      }

      /* Get players */

      const {
        data: players,
        error: playersError
      } = await supabase
        .from("match_players")
        .select("*")
        .eq("match_id", matchId);

      if (playersError) {
        return res.status(500).json({
          success: false,
          error: playersError.message
        });
      }

      if (
        players.length <
        match.max_players
      ) {

        return res.status(400).json({
          success: false,
          error:
            `Waiting for players. ${players.length}/${match.max_players} joined.`
        });

      }

      /* Set all players alive */

      const {
        error: aliveError
      } = await supabase
        .from("match_players")
        .update({
          status: "ALIVE"
        })
        .eq("match_id", matchId);

      if (aliveError) {
        return res.status(500).json({
          success: false,
          error: aliveError.message
        });
      }

      /* Start match */

      const {
        data,
        error
      } = await supabase
        .from("matches")
        .update({
          status: "LIVE",
          started_at:
            new Date().toISOString()
        })
        .eq("id", matchId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      res.json({
        success: true,
        match: data
      });

    } catch (error) {

      console.error(
        "Start match error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });

    }

  }
);


/* =========================================================
   ELIMINATE PLAYER
========================================================= */

app.post(
  "/api/matches/:id/eliminate",
  async (req, res) => {

    try {

      const matchId = Number(
        req.params.id
      );

      const playerId = Number(
        req.body.player_id
      );

      if (!matchId || !playerId) {
        return res.status(400).json({
          success: false,
          error:
            "Match ID and player ID are required."
        });
      }

      /* Get match */

      const {
        data: match,
        error: matchError
      } = await supabase
        .from("matches")
        .select("id,status")
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        return res.status(404).json({
          success: false,
          error: "Match not found."
        });
      }

      if (match.status !== "LIVE") {
        return res.status(400).json({
          success: false,
          error:
            "Players can only be eliminated during a live match."
        });
      }

      /* Find player */

      const {
        data: player,
        error: playerError
      } = await supabase
        .from("match_players")
        .select("*")
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .single();

      if (playerError || !player) {
        return res.status(404).json({
          success: false,
          error:
            "Player not found in this match."
        });
      }

      if (player.status === "ELIMINATED") {
        return res.status(400).json({
          success: false,
          error:
            "Player is already eliminated."
        });
      }

      /* Eliminate */

      const {
        data,
        error
      } = await supabase
        .from("match_players")
        .update({
          status: "ELIMINATED"
        })
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      res.json({
        success: true,
        message:
          "Player has been eliminated.",
        player: data
      });

    } catch (error) {

      console.error(
        "Eliminate player error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });

    }

  }
);


/* =========================================================
   FINISH MATCH
========================================================= */

app.post(
  "/api/matches/:id/finish",
  async (req, res) => {

    try {

      const matchId = Number(
        req.params.id
      );

      if (!matchId) {
        return res.status(400).json({
          success: false,
          error: "Invalid match ID."
        });
      }

      /* Get match */

      const {
        data: match,
        error: matchError
      } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        return res.status(404).json({
          success: false,
          error: "Match not found."
        });
      }

      if (match.status !== "LIVE") {
        return res.status(400).json({
          success: false,
          error:
            "This match is not live."
        });
      }

      /* Finish match */

      const {
        data,
        error
      } = await supabase
        .from("matches")
        .update({
          status: "FINISHED",
          finished_at:
            new Date().toISOString()
        })
        .eq("id", matchId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      res.json({
        success: true,
        match: data
      });

    } catch (error) {

      console.error(
        "Finish match error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });

    }

  }
);


/* =========================================================
   404 API HANDLER
========================================================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found."
  });
});


/* =========================================================
   SERVER
========================================================= */

const PORT =
  process.env.PORT || 3000;

if (require.main === module) {

  app.listen(
    PORT,
    () => {

      console.log("");
      console.log("================================");
      console.log("       FFARENA SERVER ONLINE");
      console.log("================================");
      console.log(
        `http://localhost:${PORT}`
      );
      console.log("");
      console.log(
        `Database test: http://localhost:${PORT}/api/database-test`
      );
      console.log("");
      console.log(
        `Players API: http://localhost:${PORT}/api/players`
      );
      console.log("");
      console.log(
        `Chat API: http://localhost:${PORT}/api/messages`
      );
      console.log("");

    }
  );
}


module.exports = app;