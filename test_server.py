import json
import unittest
from unittest.mock import patch
import server
from antseed_client import AntseedError, upstream_error

SOURCE = "Asha will check the room by 2026-11-05."


def raw(owner="Asha", due="by 2026-11-05", source=SOURCE):
    return {
        "title": "Demo planning",
        "tasks": [
            {
                "title": "Check the room",
                "owner": owner,
                "due_text": due,
                "source": source,
            }
        ],
        "decisions": [],
        "open_questions": [],
    }


def offer(char, model):
    return {
        "id": char * 40 + "@" + model,
        "peer": char * 40,
        "model": model,
        "provider": "Test provider",
        "max_output_tokens": 2200,
        "input_usd_per_million": 0,
        "output_usd_per_million": 0,
    }


class PlanTests(unittest.TestCase):
    def test_exact_source_owner_and_iso_date(self):
        plan = server.ground_plan(raw(), SOURCE, "2026-11-02")
        self.assertEqual(plan["tasks"][0]["owner"], "Asha")
        self.assertEqual(plan["tasks"][0]["due_date"], "2026-11-05")
        self.assertFalse(plan["tasks"][0]["confirmed"])

    def test_invented_owner_and_date_are_removed(self):
        task = server.ground_plan(raw("Rohan", "tomorrow"), SOURCE, "2026-11-02")[
            "tasks"
        ][0]
        self.assertIsNone(task["owner"])
        self.assertIsNone(task["due_text"])
        self.assertIsNone(task["due_date"])
        self.assertEqual(len(task["flags"]), 2)

    def test_owner_requires_name_not_partial_word(self):
        source = "Planning the room needs a volunteer."
        task = server.ground_plan(raw("Ann", None, source), source, "2026-11-02")[
            "tasks"
        ][0]
        self.assertIsNone(task["owner"])

    def test_vague_deadline_is_not_invented_as_calendar_date(self):
        source = "Asha will check the room before rehearsal."
        task = server.ground_plan(
            raw("Asha", "before rehearsal", source), source, "2026-11-02"
        )["tasks"][0]
        self.assertEqual(task["due_text"], "before rehearsal")
        self.assertIsNone(task["due_date"])

    def test_invalid_date_in_notes_requires_review(self):
        source = "Asha will check the room by 2026-02-30."
        task = server.ground_plan(
            raw("Asha", "by 2026-02-30", source), source, "2026-11-02"
        )["tasks"][0]
        self.assertIsNone(task["due_date"])
        self.assertTrue(task["flags"])

    def test_unmatched_source_is_not_silently_accepted(self):
        with self.assertRaises(AntseedError) as caught:
            server.ground_plan(
                raw(source="A different statement."), SOURCE, "2026-11-02"
            )
        self.assertEqual(caught.exception.code, "ungrounded_plan")

    def test_invalid_decision_is_excluded_without_losing_supported_task(self):
        data = raw()
        data["decisions"] = [
            {"text": "Book a paid venue", "source": "We approved a venue budget."}
        ]
        plan = server.ground_plan(data, SOURCE, "2026-11-02")
        self.assertEqual(plan["decisions"], [])
        self.assertEqual(len(plan["tasks"]), 1)
        self.assertTrue(plan["warnings"])

    def test_no_actions_is_valid(self):
        data = {
            "title": "Discussion",
            "tasks": [],
            "decisions": [],
            "open_questions": [],
        }
        self.assertEqual(
            server.ground_plan(data, "We discussed possible ideas.", "2026-11-02")[
                "tasks"
            ],
            [],
        )

    def test_free_route_is_pinned_and_bad_output_can_retry(self):
        offers = [offer("a", "model-a"), offer("b", "model-b")]

        def respond(path, payload):
            content = (
                "not JSON" if payload["model"] == offers[0]["id"] else json.dumps(raw())
            )
            return {"choices": [{"message": {"content": content}}]}, {
                "peer": payload["model"].split("@")[0],
                "seconds": 1,
                "status": 200,
            }

        with patch.object(
            server, "discover", return_value={"offers": offers}
        ), patch.object(server, "antseed_request", side_effect=respond) as request:
            result = server.extract(SOURCE, "2026-11-02")
        self.assertEqual(result["offer"], offers[1])
        self.assertEqual(request.call_count, 2)
        self.assertEqual(len(result["attempts"]), 2)
        self.assertEqual(
            [call.args[1]["model"] for call in request.call_args_list],
            [item["id"] for item in offers],
        )

    def test_spend_cap_error_is_not_retried(self):
        error = upstream_error(
            402,
            {
                "error": {
                    "code": "spend_limit_reached",
                    "limit": {"held_usd": "0.3", "spent_usd": "0"},
                }
            },
        )
        with patch.object(
            server,
            "discover",
            return_value={"offers": [offer("a", "model-a"), offer("b", "model-b")]},
        ), patch.object(server, "antseed_request", side_effect=error) as request:
            with self.assertRaises(AntseedError):
                server.extract(SOURCE, "2026-11-02")
        self.assertEqual(request.call_count, 1)
        self.assertEqual(error.public()["details"]["spent_usd"], "0")


if __name__ == "__main__":
    unittest.main()
